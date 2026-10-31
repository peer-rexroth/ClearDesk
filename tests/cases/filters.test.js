// taskMatchesFilters — including the ignoreProject/ignoreStatus opts that
// board view and list view rely on to pick which axis they group by
// without the sidebar/toolbar filters collapsing everything to one column.

function filterFixtureTask(){
  return { id: 't1', title: 'Fixture task', projectId: 'proj-personal', status: 'todo', priority: 'medium', subtasks: [], tags: [] };
}

test('project filter excludes tasks from other projects by default', function () {
  tasks = [filterFixtureTask()];
  filterProjectId = 'proj-work';
  const t = tasks.find(x => x.projectId === 'proj-personal');
  assertFalse(taskMatchesFilters(t));
});

test('ignoreProject lets a task through regardless of the project filter', function () {
  tasks = [filterFixtureTask()];
  filterProjectId = 'proj-work';
  const t = tasks.find(x => x.projectId === 'proj-personal');
  assertTrue(taskMatchesFilters(t, { ignoreProject: true }));
});

test('status filter excludes non-matching status by default', function () {
  tasks = [filterFixtureTask()];
  filterStatus = ['done'];
  const t = tasks.find(x => x.status === 'todo');
  assertFalse(taskMatchesFilters(t));
});

test('ignoreStatus lets a task through regardless of the status filter', function () {
  tasks = [filterFixtureTask()];
  filterStatus = ['done'];
  const t = tasks.find(x => x.status === 'todo');
  assertTrue(taskMatchesFilters(t, { ignoreStatus: true }));
});

test('allTasksHiddenProjectIds hides a project\'s tasks from the true All Tasks state', function () {
  tasks = [filterFixtureTask()]; // projectId: proj-personal
  allTasksHiddenProjectIds = ['proj-personal'];
  assertFalse(taskMatchesFilters(tasks[0]), 'a task in a hidden project should not match in All Tasks');
});

test('allTasksHiddenProjectIds is ignored once a project filter is active', function () {
  tasks = [filterFixtureTask()];
  allTasksHiddenProjectIds = ['proj-personal'];
  filterProjectId = 'proj-personal';
  assertTrue(taskMatchesFilters(tasks[0]), 'explicitly filtering to a project should still show its tasks even if it is hidden from All Tasks');
});

test('allTasksHiddenProjectIds is ignored in My Day/This Week/Overdue smart views', function () {
  tasks = [{ ...filterFixtureTask(), dueDate: todayStr() }];
  allTasksHiddenProjectIds = ['proj-personal'];
  myDayFilter = true;
  assertTrue(taskMatchesFilters(tasks[0]), 'smart views should not be affected by the All Tasks project selection');
});

test('taskMatchesFilters itself does not apply allTasksHiddenProjectIds when ignoreProject is set', function () {
  // Board view enforces the hidden set at the column level (getBoardColumns()
  // drops the column entirely — see board.test.js), not per-task here, so
  // this function-level check must stay a no-op under ignoreProject.
  tasks = [filterFixtureTask()];
  allTasksHiddenProjectIds = ['proj-personal'];
  assertTrue(taskMatchesFilters(tasks[0], { ignoreProject: true }));
});

test('toggleAllTasksProject adds and removes a project from the hidden list', function () {
  toggleAllTasksProject('proj-work');
  assertDeepEqual(allTasksHiddenProjectIds, ['proj-work']);
  toggleAllTasksProject('proj-work');
  assertDeepEqual(allTasksHiddenProjectIds, []);
});

test('renderAllTasksProjectsModal reflects the current hidden set', function () {
  allTasksHiddenProjectIds = ['proj-work'];
  renderAllTasksProjectsModal();
  const html = document.getElementById('allTasksProjectsList').innerHTML;
  const rows = html.split('proj-select-row').slice(1); // one chunk per project row
  const workRow = rows.find(r => r.includes("toggleAllTasksProject('proj-work')"));
  const personalRow = rows.find(r => r.includes("toggleAllTasksProject('proj-personal')"));
  assertNotIncludes(workRow, 'proj-select-check checked', 'the hidden project\'s row should render unchecked');
  assertIncludes(personalRow, 'proj-select-check checked', 'a project not in the hidden list should render checked');
});

test('search query matches title, notes, subtask text, and tag labels', function () {
  tasks = [
    { id: 't1', title: 'Nothing relevant', notes: '', projectId: 'proj-inbox', status: 'todo', priority: 'medium', subtasks: [], tags: [] },
    { id: 't2', title: 'Also nothing', notes: 'mentions zebra somewhere', projectId: 'proj-inbox', status: 'todo', priority: 'medium', subtasks: [], tags: [] }
  ];
  searchQuery = 'zebra';
  assertFalse(taskMatchesFilters(tasks[0]));
  assertTrue(taskMatchesFilters(tasks[1]));
});

test('getFilteredSortedTasks always sorts done tasks after not-done tasks', function () {
  tasks = [
    { id: 't1', title: 'Done one', projectId: 'proj-inbox', status: 'done', priority: 'medium', subtasks: [], tags: [], completedAt: 1 },
    { id: 't2', title: 'Still open', projectId: 'proj-inbox', status: 'todo', priority: 'medium', subtasks: [], tags: [] }
  ];
  const sorted = getFilteredSortedTasks();
  assertEqual(sorted[sorted.length - 1].status, 'done');
});

test('smart sort breaks a priority+due-date tie by status, In Progress before Not Started', function () {
  tasks = [
    { id: 't1', title: 'Not started one', projectId: 'proj-inbox', status: 'todo', priority: 'medium', dueDate: '2026-01-01', subtasks: [], tags: [], createdAt: 100 },
    { id: 't2', title: 'In progress one', projectId: 'proj-inbox', status: 'doing', priority: 'medium', dueDate: '2026-01-01', subtasks: [], tags: [], createdAt: 100 }
  ];
  const sorted = getFilteredSortedTasks();
  assertEqual(sorted[0].id, 't2', 'In Progress should sort before Not Started when priority and due date tie');
  assertEqual(sorted[1].id, 't1');
});

test('smart sort still falls back to createdAt when priority, due date, and status all tie', function () {
  tasks = [
    { id: 't1', title: 'Older', projectId: 'proj-inbox', status: 'todo', priority: 'medium', dueDate: null, subtasks: [], tags: [], createdAt: 100 },
    { id: 't2', title: 'Newer', projectId: 'proj-inbox', status: 'todo', priority: 'medium', dueDate: null, subtasks: [], tags: [], createdAt: 200 }
  ];
  const sorted = getFilteredSortedTasks();
  assertEqual(sorted[0].id, 't2', 'newest-created should still win the final tiebreak');
});

// Filter chips: "All" is the unfiltered state (pickFilterValue)
test('choosing an option while All is on selects just that option', function () {
  const all = ['todo', 'doing', 'done'];
  assertEqual(JSON.stringify(pickFilterValue(all, all, 'doing')), JSON.stringify(['doing']));
});

test('choosing more options adds to the subset; undoing the last one goes back to All', function () {
  const all = ['todo', 'doing', 'done'];
  let cur = pickFilterValue(all, all, 'doing');
  cur = pickFilterValue(cur, all, 'done');
  assertEqual(JSON.stringify(cur), JSON.stringify(['doing', 'done']));
  cur = pickFilterValue(cur, all, 'done');
  assertEqual(JSON.stringify(cur), JSON.stringify(['doing']));
  cur = pickFilterValue(cur, all, 'doing');
  assertEqual(JSON.stringify(cur), JSON.stringify(all), 'an empty filter is never left behind');
});

test('choosing every option, or All, gives All', function () {
  const all = ['todo', 'doing', 'done'];
  assertEqual(JSON.stringify(pickFilterValue(['todo', 'doing'], all, 'done')), JSON.stringify(all));
  assertEqual(JSON.stringify(pickFilterValue(['todo'], all, null)), JSON.stringify(all));
  assertEqual(JSON.stringify(pickFilterValue(all, all, null)), JSON.stringify(all), 'All while on stays on (it used to empty the filter)');
});

test('the status and priority chips use the same rule', function () {
  filterStatus = STATUSES.map(x => x.id); filterPriority = PRIORITIES.map(x => x.id);
  setStatusFilter('done'); setPriorityFilter('high');
  assertEqual(JSON.stringify(filterStatus), JSON.stringify(['done']));
  assertEqual(JSON.stringify(filterPriority), JSON.stringify(['high']));
  setStatusFilter(null); setPriorityFilter(null);
  assertEqual(filterStatus.length, STATUSES.length);
  assertEqual(filterPriority.length, PRIORITIES.length);
});
