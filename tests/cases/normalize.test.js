// normalizeData() / load() — schema defaults and migration.

test('project missing icon defaults to folder', function () {
  projects = [{ id: 'p1', name: 'Old' }];
  tasks = [];
  normalizeData();
  assertEqual(projById('p1').icon, 'folder');
});

test('normalizeData drops an allTasksHiddenProjectIds entry for a project that no longer exists', function () {
  allTasksHiddenProjectIds = ['proj-work', 'does-not-exist'];
  normalizeData();
  assertDeepEqual(allTasksHiddenProjectIds, ['proj-work']);
});

test('missing proj-inbox is recreated at the front, locked', function () {
  projects = [{ id: 'p1', name: 'Only', icon: 'folder' }];
  tasks = [];
  normalizeData();
  assertEqual(projects[0].id, 'proj-inbox');
  assertTrue(projects[0].locked, 'proj-inbox should be locked');
});

test('task with unknown projectId is reassigned to proj-inbox', function () {
  tasks = [{ id: 't1', title: 'Orphan', projectId: 'does-not-exist' }];
  normalizeData();
  assertEqual(tasks[0].projectId, 'proj-inbox');
});

test('task missing priority/status get medium/todo defaults', function () {
  tasks = [{ id: 't1', title: 'Bare', projectId: 'proj-inbox' }];
  normalizeData();
  assertEqual(tasks[0].priority, 'medium');
  assertEqual(tasks[0].status, 'todo');
});

test('subtask missing its own subtasks array gets one', function () {
  tasks = [{ id: 't1', title: 'T', projectId: 'proj-inbox', subtasks: [{ id: 's1', text: 'step-holder', done: false }] }];
  normalizeData();
  assertDeepEqual(tasks[0].subtasks[0].subtasks, []);
});

test('step missing its own subtasks array gets one (sub-step support)', function () {
  tasks = [{ id: 't1', title: 'T', projectId: 'proj-inbox', subtasks: [{ id: 's1', text: 'Sub', done: false, subtasks: [{ id: 'st1', text: 'sub-step-holder', done: false }] }] }];
  normalizeData();
  assertDeepEqual(tasks[0].subtasks[0].subtasks[0].subtasks, []);
});

test('unknown tag ids are dropped, known ones kept', function () {
  tasks = [{ id: 't1', title: 'T', projectId: 'proj-inbox', tags: ['deep-work', 'not-a-real-tag'] }];
  normalizeData();
  assertDeepEqual(tasks[0].tags, ['deep-work']);
});

test('completedAt backfills from updatedAt for already-done tasks', function () {
  tasks = [{ id: 't1', title: 'Done long ago', projectId: 'proj-inbox', status: 'done', updatedAt: 12345 }];
  normalizeData();
  assertEqual(tasks[0].completedAt, 12345);
});

test('completedAt stays null for not-done tasks', function () {
  tasks = [{ id: 't1', title: 'Still open', projectId: 'proj-inbox', status: 'todo', updatedAt: 12345 }];
  normalizeData();
  assertEqual(tasks[0].completedAt, null);
});

// Regression coverage for the security review: mergeData()/applyImport('replace')
// trust ids/icons from an external .json file as-is, and every id gets
// interpolated unescaped into onclick/data-id attributes at render time.
// normalizeData() is the one place every external-data path routes through,
// so it's what regenerates/rejects anything that couldn't have come from
// genId() or the icon picker — closing the gap without touching every
// render call site.

test('a task id containing HTML-breaking characters gets regenerated', function () {
  tasks = [{ id: 'x"><img src=x onerror=alert(1)>', title: 'Malicious import', projectId: 'proj-inbox' }];
  normalizeData();
  assertTrue(isSafeId(tasks[0].id), 'the unsafe id should have been replaced');
});

test('a subtask/step/sub-step id containing HTML-breaking characters gets regenerated', function () {
  tasks = [{
    id: 't1', title: 'T', projectId: 'proj-inbox',
    subtasks: [{ id: 's"onmouseover=alert(1)', text: 'Sub', done: false, subtasks: [{ id: 'st\'});alert(1);(\'', text: 'Step', done: false, subtasks: [{ id: 'sst"><script>alert(1)</script>', text: 'Sub-step', done: false }] }] }]
  }];
  normalizeData();
  assertTrue(isSafeId(tasks[0].subtasks[0].id), 'the unsafe subtask id should have been replaced');
  assertTrue(isSafeId(tasks[0].subtasks[0].subtasks[0].id), 'the unsafe step id should have been replaced');
  assertTrue(isSafeId(tasks[0].subtasks[0].subtasks[0].subtasks[0].id), 'the unsafe sub-step id should have been replaced');
});

test('a project id containing HTML-breaking characters gets regenerated', function () {
  projects = [{ id: 'p"><script>alert(1)</script>', name: 'Malicious import', icon: 'folder' }];
  tasks = [];
  normalizeData();
  assertTrue(projects.some(p => isSafeId(p.id) && p.name === 'Malicious import'));
});

test('a plain locally-generated-looking id (with a hyphen, like proj-work) survives normalizeData unchanged', function () {
  tasks = [{ id: 't1', title: 'T', projectId: 'proj-work' }];
  normalizeData();
  assertEqual(tasks[0].id, 't1', 'a normal alphanumeric id should not be touched');
  assertTrue(projects.some(p => p.id === 'proj-work'), 'the default hyphenated proj-work id should not be touched');
});

test('a project icon not in PROJECT_ICONS falls back to folder', function () {
  projects = [{ id: 'p1', name: 'Bad icon', icon: 'x"><img src=x onerror=alert(1)>' }];
  tasks = [];
  normalizeData();
  assertEqual(projById('p1').icon, 'folder');
});

test('proj-deleted keeps its trash icon through normalizeData even though trash is not in the picker list', function () {
  normalizeData();
  assertEqual(projById('proj-deleted').icon, 'trash');
});

test('load() migrates old-schema data read from localStorage', function () {
  // Simulates data saved before steps/project-icons existed: no subtasks
  // array on a subtask, no project icon, no tags array on the task.
  const oldData = {
    projects: [{ id: 'proj-inbox', name: 'Inbox', locked: true }],
    tasks: [{ id: 't1', title: 'Legacy task', projectId: 'proj-inbox', subtasks: [{ id: 's1', text: 'old step' }] }]
  };
  localStorage.setItem('mytasks_data_v1', JSON.stringify(oldData));
  load();
  assertEqual(projById('proj-inbox').icon, 'folder');
  assertDeepEqual(tasks[0].subtasks[0].subtasks, []);
  assertDeepEqual(tasks[0].tags, []);
});

// ---- the project order, the "shown in All Tasks" choice and the view you left ----
function projsFixture() {
  tasks = []; deletedProjectIds = []; trashedTasks = []; purgedTaskIds = [];
  projects = [{ id: 'proj-inbox', name: 'Inbox', icon: 'inbox', locked: true }, { id: 'a', name: 'A', icon: 'folder' }, { id: 'b', name: 'B', icon: 'folder' }, { id: 'proj-deleted', name: 'Deleted', icon: 'trash', locked: true }];
  allTasksHiddenProjectIds = []; projectsPrefsAt = 0;
}

test('the project order, the hidden-from-All-Tasks list and the view you left survive save and load', function () {
  projsFixture();
  var b = projects.splice(2, 1)[0]; projects.splice(1, 0, b);
  allTasksHiddenProjectIds = ['a']; touchProjectsPrefs();
  filterProjectId = 'b'; myDayFilter = false; filterStatus = ['todo'];
  save();
  projects = []; allTasksHiddenProjectIds = []; filterProjectId = null; filterStatus = STATUSES.map(function (s) { return s.id; }); projectsPrefsAt = 0;
  load();
  assertDeepEqual(projects.map(function (p) { return p.id; }), ['proj-inbox', 'b', 'a', 'proj-deleted']);
  assertDeepEqual(allTasksHiddenProjectIds, ['a']);
  assertEqual(filterProjectId, 'b', 'the project you were looking at is open again');
  assertDeepEqual(filterStatus, ['todo']);
  assertTrue(projectsPrefsAt > 0);
});

test('a project that no longer exists is not reopened, and My Day wins over a saved project', function () {
  projsFixture();
  filterProjectId = 'gone'; save(); filterProjectId = 'x'; load();
  assertEqual(filterProjectId, null);
  filterProjectId = 'a'; myDayFilter = true; save(); filterProjectId = null; myDayFilter = false; load();
  assertTrue(myDayFilter && filterProjectId === null, 'My Day, not the project');
  myDayFilter = false;
});

test('merging a file: the newer project order and shown-projects choice win, an older one does not', function () {
  projsFixture();
  var incoming = { projects: [projects[0], projects[2], projects[1], projects[3]].map(function (p) { return Object.assign({}, p); }), tasks: [], allTasksHiddenProjectIds: ['b', 'zzz'], projectsPrefsAt: 500 };
  projectsPrefsAt = 100; mergeData(incoming);
  assertDeepEqual(projects.map(function (p) { return p.id; }), ['proj-inbox', 'b', 'a', 'proj-deleted'], 'newer: the other order is taken');
  assertDeepEqual(allTasksHiddenProjectIds, ['b'], 'and its list (ids that do not exist are dropped)');
  assertEqual(projectsPrefsAt, 500);
  incoming.projectsPrefsAt = 200; incoming.projects = incoming.projects.slice().reverse(); incoming.allTasksHiddenProjectIds = [];
  mergeData(incoming);
  assertDeepEqual(projects.map(function (p) { return p.id; }), ['proj-inbox', 'b', 'a', 'proj-deleted'], 'older: ours stays');
  assertDeepEqual(allTasksHiddenProjectIds, ['b']);
});
