// UX pass: quick-add shorthand, click-to-open, inline cell editing, the
// collapsed filter popover state, sync banner and board group-by-status.

function uxTask(over) {
  return Object.assign({ id: 'u1', title: 'Task', notes: '', projectId: 'proj-inbox', status: 'todo',
    priority: 'medium', dueDate: null, tags: [], subtasks: [], createdAt: 1, updatedAt: 1 }, over || {});
}
function uxQuickAdd(text, shift) {
  const input = document.getElementById('quickAddInput');
  input.value = text;
  quickAddTask({ key: 'Enter', shiftKey: !!shift, target: input });
  return tasks[0];
}

test('parseQuickAdd pulls out priority, project, tag and a date word', function () {
  const r = parseQuickAdd('Call dentist tomorrow !high #work @deep');
  assertEqual(r.title, 'Call dentist');
  assertEqual(r.priority, 'high');
  assertEqual(r.projectId, 'proj-work');
  assertEqual(r.dueDate, isoAddDays(todayStr(), 1));
  assertEqual(r.tags.length, 1);
});

test('parseQuickAdd handles in N days / next week / ISO date / weekday', function () {
  assertEqual(parseQuickAdd('x in 3 days').dueDate, isoAddDays(todayStr(), 3));
  assertEqual(parseQuickAdd('x in 2 weeks').dueDate, isoAddDays(todayStr(), 14));
  assertEqual(parseQuickAdd('x 2031-04-09').dueDate, '2031-04-09');
  const nw = parseQuickAdd('x next week').dueDate;
  assertEqual(isoWeekday(nw), 1, 'next week lands on a Monday');
  const fri = parseQuickAdd('lunch fri').dueDate;
  assertEqual(isoWeekday(fri), 5);
  assertTrue(fri > todayStr(), 'a weekday word is always strictly in the future');
});

test('parseQuickAdd leaves unknown #project / @tag tokens in the title', function () {
  const r = parseQuickAdd('Fix #nosuchproject and @nosuchtag');
  assertEqual(r.title, 'Fix #nosuchproject and @nosuchtag');
  assertEqual(r.projectId, null);
  assertEqual(r.tags.length, 0);
});

test('parseQuickAdd keeps the raw text when parsing would leave no title', function () {
  const r = parseQuickAdd('tomorrow !high');
  assertEqual(r.title, 'tomorrow !high');
  assertEqual(r.dueDate, null);
  assertEqual(r.priority, null);
});

test('quickAddTask applies parsed fields; Shift+Enter keeps the text verbatim', function () {
  const t = uxQuickAdd('Buy milk !low #personal');
  assertEqual(t.title, 'Buy milk');
  assertEqual(t.priority, 'low');
  assertEqual(t.projectId, 'proj-personal');
  const v = uxQuickAdd('Buy eggs !low #personal', true);
  assertEqual(v.title, 'Buy eggs !low #personal');
  assertEqual(v.priority, 'medium');
});

test('quickAddTask in My Day defaults the due date to today', function () {
  myDayFilter = true;
  assertEqual(uxQuickAdd('Stretch').dueDate, todayStr());
});

test('a plain click on a list row opens the drawer', function () {
  tasks = [uxTask()];
  handleRowClick({ shiftKey: false, ctrlKey: false, metaKey: false }, 'u1');
  assertEqual(activeTaskId, 'u1');
});

test('ctrl-click still multi-selects without opening the drawer', function () {
  tasks = [uxTask()];
  handleRowClick({ shiftKey: false, ctrlKey: true, metaKey: false }, 'u1');
  assertTrue(selectedTaskIds.has('u1'));
  assertEqual(activeTaskId, null);
});

test('pickCell changes priority, status and due date through updateTaskField', function () {
  tasks = [uxTask()];
  pickCell(null, 'u1', 'priority', 'high');
  assertEqual(tasks[0].priority, 'high');
  pickCell(null, 'u1', 'status', 'doing');
  assertEqual(tasks[0].status, 'doing');
  pickCell(null, 'u1', 'dueDate', '2031-01-02');
  assertEqual(tasks[0].dueDate, '2031-01-02');
  pickCell(null, 'u1', 'dueDate', null);
  assertEqual(tasks[0].dueDate, null);
});

test('picking Completed from the status popover sets completedAt', function () {
  tasks = [uxTask()];
  pickCell(null, 'u1', 'status', 'done');
  assertTrue(!!tasks[0].completedAt);
});

test('clearFilters restores every status/priority and drops tag filters', function () {
  filterStatus = ['todo']; filterPriority = ['high']; filterTags = ['x'];
  clearFilters();
  assertEqual(filterStatus.length, STATUSES.length);
  assertEqual(filterPriority.length, PRIORITIES.length);
  assertEqual(filterTags.length, 0);
});

test('board grouped by status gives one column per status and ignores the status filter', function () {
  tasks = [uxTask({ id: 'a', status: 'todo' }), uxTask({ id: 'b', status: 'doing' }), uxTask({ id: 'c', status: 'done' })];
  boardGroup = 'status';
  filterStatus = ['todo'];
  const cols = getBoardColumns();
  assertDeepEqual(cols.map(c => c.status.id), ['todo', 'doing', 'done']);
  assertEqual(cols.find(c => c.status.id === 'doing').tasks.length, 1, 'the status filter must not empty other columns');
});

test('board grouped by status still honours the project filter', function () {
  tasks = [uxTask({ id: 'a', projectId: 'proj-work' }), uxTask({ id: 'b', projectId: 'proj-personal' })];
  boardGroup = 'status';
  filterProjectId = 'proj-work';
  const todo = getBoardColumns().find(c => c.status.id === 'todo');
  assertDeepEqual(todo.tasks.map(t => t.id), ['a']);
});

test('dropping a card on a status column sets status, not project', function () {
  tasks = [uxTask({ id: 'a', projectId: 'proj-work' })];
  boardGroup = 'status';
  draggingTaskId = 'a';
  handleBoardDropStatus({ preventDefault() {}, currentTarget: document.getElementById('board') }, 'doing');
  assertEqual(tasks[0].status, 'doing');
  assertEqual(tasks[0].projectId, 'proj-work');
});

test('renderBoard in status mode renders without throwing and labels every status column', function () {
  tasks = [uxTask({ id: 'a' })];
  boardGroup = 'status';
  renderBoard();
  const html = document.getElementById('board').innerHTML;
  STATUSES.forEach(s => assertIncludes(html, s.label));
});

test('setBoardGroup persists the choice and falls back to project for junk', function () {
  setBoardGroup('status');
  assertEqual(boardGroup, 'status');
  assertEqual(localStorage.getItem('mytasks_boardgroup'), 'status');
  setBoardGroup('nonsense');
  assertEqual(boardGroup, 'project');
});

test('sync banner shows for an unlinked file and stays hidden once dismissed', function () {
  const el = document.getElementById('syncBanner');
  showSyncBanner(null);
  assertTrue(el.classList.contains('show'));
  dismissSyncBanner();
  assertFalse(el.classList.contains('show'));
  showSyncBanner(null);
  assertFalse(el.classList.contains('show'), 'a dismissed banner stays hidden for the session');
});
