// Tombstones (deletedTaskIds/deletedProjectIds) — fix for "the 3 bundled
// demo tasks come back after reconnecting a linked file, even though I
// deleted/completed them". Root cause: mergeData() only ever saw "is this id
// in my array right now?" — an id absent because it was deleted looked
// identical to an id the app had simply never seen before, so any merge
// (linkFile, reconnectFile, initFileSync, fileSyncWrite's cross-tab merge)
// treated a stale copy still sitting in the linked file as legitimately new
// and silently re-added it. Tombstones make "deleted" a fact that survives
// the merge instead of just being the absence of a fact.

test('deleteTask records a tombstone, and undo clears it again', function () {
  tasks = [{ id: 't1', title: 'Welcome to mydesk', projectId: 'proj-inbox', status: 'todo', priority: 'medium', subtasks: [], tags: [] }];
  deleteTask('t1');
  modalTarget.action();
  assertTrue(deletedTaskIds.some(x => x.id === 't1'), 'deleting should tombstone the id');
  triggerToastUndo();
  assertFalse(deletedTaskIds.some(x => x.id === 't1'), 'undoing the delete should clear the tombstone');
  assertTrue(tasks.some(t => t.id === 't1'), 'undo should restore the task itself');
});

test('bulkDelete tombstones every removed id, and undo clears them all', function () {
  tasks = [
    { id: 't1', title: 'One', projectId: 'proj-inbox', status: 'todo', priority: 'medium', subtasks: [], tags: [] },
    { id: 't2', title: 'Two', projectId: 'proj-inbox', status: 'todo', priority: 'medium', subtasks: [], tags: [] }
  ];
  selectedTaskIds = new Set(['t1', 't2']);
  bulkDelete();
  modalTarget.action();
  assertTrue(deletedTaskIds.some(x => x.id === 't1') && deletedTaskIds.some(x => x.id === 't2'));
  triggerToastUndo();
  assertEqual(deletedTaskIds.length, 0);
  assertEqual(tasks.length, 2);
});

test('deleteProject records a tombstone, and undo clears it again', function () {
  deleteProject('proj-work');
  modalTarget.action();
  assertTrue(deletedProjectIds.some(x => x.id === 'proj-work'));
  triggerToastUndo();
  assertFalse(deletedProjectIds.some(x => x.id === 'proj-work'));
});

test('purgeOldCompletedTasks tombstones what it purges', function () {
  const old = Date.now() - (COMPLETED_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000;
  tasks = [{ id: 'stale-done', title: 'Ancient', projectId: 'proj-inbox', status: 'done', priority: 'medium', completedAt: old, subtasks: [], tags: [] }];
  purgeOldCompletedTasks();
  assertEqual(tasks.length, 0);
  assertTrue(deletedTaskIds.some(x => x.id === 'stale-done'));
});

test('mergeData does not resurrect a task deleted locally after the incoming copy was last touched', function () {
  tasks = [];
  deletedTaskIds = [{ id: 't1', deletedAt: 1000 }];
  const { added } = mergeData({ tasks: [{ id: 't1', title: 'Stale copy still sitting in the linked file', projectId: 'proj-inbox', updatedAt: 500 }] });
  assertEqual(added, 0);
  assertEqual(tasks.length, 0);
});

test('mergeData lets a genuinely newer external edit un-delete a task, and clears the stale tombstone', function () {
  tasks = [];
  deletedTaskIds = [{ id: 't1', deletedAt: 1000 }];
  const { added } = mergeData({ tasks: [{ id: 't1', title: 'Edited on another device after the local delete', projectId: 'proj-inbox', updatedAt: 2000 }] });
  assertEqual(added, 1);
  assertEqual(tasks.length, 1);
  assertFalse(deletedTaskIds.some(x => x.id === 't1'), 'the tombstone should be cleared once the newer edit wins');
});

test('mergeData does not resurrect a deleted project', function () {
  projects = [];
  deletedProjectIds = [{ id: 'proj-work', deletedAt: 1000 }];
  mergeData({ projects: [{ id: 'proj-work', name: 'Work', icon: 'briefcase' }] });
  assertFalse(projects.some(p => p.id === 'proj-work'));
});

test('mergeData merges incoming tombstones so a deletion recorded elsewhere propagates here', function () {
  tasks = [{ id: 't1', title: 'Bundled demo task', projectId: 'proj-inbox', status: 'todo', priority: 'medium', updatedAt: 100, subtasks: [], tags: [] }];
  deletedTaskIds = [];
  mergeData({ tasks: [], deletedTaskIds: [{ id: 't1', deletedAt: 500 }] });
  assertTrue(deletedTaskIds.some(x => x.id === 't1'), 'the incoming tombstone should be adopted locally');
});

// { respectTombstones: false } — the opt-out applyImport('merge') uses (but
// linkFile()/reconnectFile()/initFileSync()/fileSyncWrite() do not), since a
// manual import is a deliberate, user-picked action rather than an automatic
// background sync.
test('mergeData with respectTombstones:false brings back a task even if the incoming copy is older than the tombstone', function () {
  tasks = [];
  deletedTaskIds = [{ id: 't1', deletedAt: 2000 }];
  const { added } = mergeData({ tasks: [{ id: 't1', title: 'Deleted then reimported', projectId: 'proj-inbox', updatedAt: 1000 }] }, { respectTombstones: false });
  assertEqual(added, 1);
  assertTrue(tasks.some(t => t.id === 't1'));
  assertFalse(deletedTaskIds.some(x => x.id === 't1'), 'the tombstone should be cleared once the task is deliberately brought back');
});

test('mergeData with respectTombstones:false brings back a tombstoned project', function () {
  projects = [];
  deletedProjectIds = [{ id: 'proj-work', deletedAt: Date.now() }];
  mergeData({ projects: [{ id: 'proj-work', name: 'Work', icon: 'briefcase' }] }, { respectTombstones: false });
  assertTrue(projects.some(p => p.id === 'proj-work'));
  assertFalse(deletedProjectIds.some(x => x.id === 'proj-work'));
});

test('applyImport merge mode brings back a task previously deleted in this browser', function () {
  tasks = [{ id: 't1', title: 'Old friend', projectId: 'proj-inbox', status: 'todo', priority: 'medium', updatedAt: 1000, subtasks: [], tags: [] }];
  deleteTask('t1'); // tombstoned with deletedAt = now, well after updatedAt: 1000
  modalTarget.action();
  pendingImportData = {
    projects: defaultProjects(),
    tasks: [{ id: 't1', title: 'Old friend', projectId: 'proj-inbox', updatedAt: 1000, subtasks: [] }]
  };
  applyImport('merge');
  assertTrue(tasks.some(t => t.id === 't1'), 'a manually-imported task should come back even though it was deleted here before');
});

test('reconnectFile() does not resurrect a task that was deleted locally, even if the linked file still has it', async function () {
  tasks = [];
  deletedTaskIds = [{ id: 't1', deletedAt: Date.now() }];
  const staleJson = JSON.stringify({
    projects: defaultProjects(),
    tasks: [{ id: 't1', title: 'Welcome to mydesk', projectId: 'proj-inbox', updatedAt: Date.now() - 999999, subtasks: [] }]
  });
  fileHandle = {
    name: 'test.json',
    requestPermission: async () => 'granted',
    getFile: async () => ({ text: async () => staleJson })
  };
  await reconnectFile();
  assertFalse(tasks.some(t => t.id === 't1'), 'a task deleted locally should stay gone after reconnecting to a stale file');
});

test('reconnectFile() does not revert a task completed locally, even if the linked file still has it as not-done', async function () {
  tasks = [{ id: 't1', title: 'Welcome to mydesk', projectId: 'proj-inbox', status: 'done', priority: 'medium', completedAt: Date.now(), updatedAt: Date.now(), subtasks: [], tags: [] }];
  const staleJson = JSON.stringify({
    projects: defaultProjects(),
    tasks: [{ id: 't1', title: 'Welcome to mydesk', projectId: 'proj-inbox', status: 'todo', updatedAt: Date.now() - 999999, subtasks: [] }]
  });
  fileHandle = {
    name: 'test.json',
    requestPermission: async () => 'granted',
    getFile: async () => ({ text: async () => staleJson })
  };
  await reconnectFile();
  assertEqual(tasks.find(t => t.id === 't1').status, 'done', 'the local completion should win over the stale not-done copy from the file');
});
