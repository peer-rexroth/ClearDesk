// Board view is grouped by project (not status) — getBoardColumns() maps
// one column per visible project, and dropping a card sets projectId, not
// status. proj-deleted is a real project (see visibleProjects() in
// delete-project.test.js) but intentionally gets no column.

test('getBoardColumns returns one column per visible project, in order', function () {
  const cols = getBoardColumns();
  assertDeepEqual(cols.map(c => c.project.id), visibleProjects().map(p => p.id));
});

test('getBoardColumns ignores the project filter within each column (ignoreProject)', function () {
  tasks = [{ id: 't1', title: 'Personal task', projectId: 'proj-personal', status: 'todo', priority: 'medium', subtasks: [], tags: [] }];
  filterProjectId = 'proj-work';
  const cols = getBoardColumns();
  const personalCol = cols.find(c => c.project.id === 'proj-personal');
  assertTrue(personalCol.tasks.length > 0, 'proj-personal column should still show its own tasks even though proj-work is the active filter');
});

test('getBoardColumns drops the column entirely for a project in allTasksHiddenProjectIds', function () {
  allTasksHiddenProjectIds = ['proj-personal'];
  const cols = getBoardColumns();
  assertFalse(cols.some(c => c.project.id === 'proj-personal'), 'a hidden project should get no column at all, not just an empty one');
});

test('getBoardColumns keeps other columns when one project is hidden', function () {
  allTasksHiddenProjectIds = ['proj-personal'];
  const cols = getBoardColumns();
  assertTrue(cols.some(c => c.project.id === 'proj-work'), 'other projects should be unaffected');
});

test('handleBoardDrop moves the dragged task to the target column\'s project, not its status', function () {
  tasks = [{ id: 't1', title: 'Inbox task', projectId: 'proj-inbox', status: 'todo', priority: 'medium', subtasks: [], tags: [] }];
  const t = tasks.find(x => x.projectId === 'proj-inbox');
  draggingTaskId = t.id;
  const fakeEvent = { preventDefault() {}, currentTarget: document.getElementById('board') };
  handleBoardDrop(fakeEvent, 'proj-personal');
  assertEqual(tasks.find(x => x.id === t.id).projectId, 'proj-personal');
  assertEqual(tasks.find(x => x.id === t.id).status, 'todo', 'status should be untouched by a board column drop');
});

test('getVisibleTasksForCollapse uses the same ignoreProject axis as getBoardColumns, so collapse-all reaches every visible column', function () {
  tasks = [
    { id: 't1', title: 'Personal task', projectId: 'proj-personal', status: 'todo', priority: 'medium', subtasks: [], tags: [] },
    { id: 't2', title: 'Work task', projectId: 'proj-work', status: 'todo', priority: 'medium', subtasks: [], tags: [] }
  ];
  viewMode = 'board';
  filterProjectId = 'proj-work';
  const visible = getVisibleTasksForCollapse();
  assertTrue(visible.some(t => t.id === 't1'), 'a task in a non-filtered project column should still be reachable by collapse-all, since board view shows every column regardless of the project filter');
});

test('getVisibleTasksForCollapse excludes tasks whose column is hidden in board view', function () {
  tasks = [{ id: 't1', title: 'Personal task', projectId: 'proj-personal', status: 'todo', priority: 'medium', subtasks: [], tags: [] }];
  viewMode = 'board';
  allTasksHiddenProjectIds = ['proj-personal'];
  const visible = getVisibleTasksForCollapse();
  assertFalse(visible.some(t => t.id === 't1'), 'collapse-all should not touch tasks whose column is not even rendered');
});

test('handleBoardDrop is a no-op when nothing is being dragged', function () {
  draggingTaskId = null;
  const before = JSON.stringify(tasks);
  const fakeEvent = { preventDefault() {}, currentTarget: document.getElementById('board') };
  handleBoardDrop(fakeEvent, 'proj-personal');
  assertEqual(JSON.stringify(tasks), before);
});

// Board cards show sub-steps read + toggle-done only (same reduced
// treatment steps themselves already get there) — no rename/delete/add/drag.
test('boardCardHtml renders a step\'s own sub-steps, read + toggle-done only', function () {
  const t = {
    id: 't1', title: 'Task', projectId: 'proj-inbox', status: 'todo', priority: 'medium', tags: [],
    subtasks: [{ id: 's1', text: 'Sub', done: false, subtasks: [{ id: 'st1', text: 'Step', done: false, subtasks: [{ id: 'sst1', text: 'Visible sub-step', done: false }] }] }]
  };
  const html = boardCardHtml(t);
  assertIncludes(html, 'Step');
  assertIncludes(html, 'Visible sub-step');
  assertIncludes(html, "toggleSubSubSubtask('t1','s1','st1','sst1')");
  assertNotIncludes(html, 'renameSubSubSubtaskInputBoard', 'sub-steps should have no rename affordance on board');
});

test('boardCardHtml hides a step\'s sub-steps when collapsedSubSubIds has that step (shared with list view)', function () {
  const t = {
    id: 't1', title: 'Task', projectId: 'proj-inbox', status: 'todo', priority: 'medium', tags: [],
    subtasks: [{ id: 's1', text: 'Sub', done: false, subtasks: [{ id: 'st1', text: 'Step', done: false, subtasks: [{ id: 'sst1', text: 'Hidden sub-step', done: false }] }] }]
  };
  collapsedSubSubIds.add('st1');
  const html = boardCardHtml(t);
  assertNotIncludes(html, 'Hidden sub-step');
});

test('the board tile is title-first: one secondary line (status only when in progress, flag for high, date, repeat), tag chips, no pill row or tag strips', function () {
  const mk = x => Object.assign({ id: 't1', title: 'A long title for the leadership team', projectId: 'proj-inbox', status: 'todo', priority: 'medium', subtasks: [], tags: [], dueDate: null, repeat: 'none', createdAt: 1, updatedAt: 1 }, x || {});
  let h = boardCardHtml(mk());
  assertNotIncludes(h, 'board-card-sec', 'a plain card has no secondary line at all'); assertNotIncludes(h, 'board-card-meta'); assertNotIncludes(h, 'tagstrip'); assertNotIncludes(h, 'badge-status', 'the default status is not labelled');
  h = boardCardHtml(mk({ priority: 'high', dueDate: '2030-03-04', repeat: 'weekly', status: 'doing', tags: [TAGS[0].id] }));
  const sec = h.slice(h.indexOf('board-card-sec'), h.indexOf('board-card-tags'));
  assertIncludes(sec, 'sec-status'); assertIncludes(sec, 'board-card-priority-icon'); assertIncludes(sec, 'sec-due'); assertIncludes(sec, 'sec-repeat');
  assertIncludes(h, 'badge badge-tag', 'tags are chips');
  boardGroup = 'status'; assertNotIncludes(boardCardHtml(mk({ status: 'doing' })), 'sec-status', 'in the status-grouped board the column already says it'); boardGroup = 'project';
  assertIncludes(boardCardHtml(mk({ dueDate: '2000-01-01' })), 'sec-due overdue', 'an overdue date is red');
});

test('the board tile\'s hover capsule keeps every action reachable: Change status always, Set due date only while there is no date, Skip only for repeating tasks', function () {
  const mk = x => Object.assign({ id: 't1', title: 'T', projectId: 'proj-inbox', status: 'todo', priority: 'medium', subtasks: [], tags: [], dueDate: null, repeat: 'none', createdAt: 1, updatedAt: 1 }, x || {});
  const caps = h => h.slice(h.indexOf('class="row-actions"'));
  let c = caps(boardCardHtml(mk())); assertIncludes(c, 'title="Change status"'); assertIncludes(c, 'title="Set due date"'); assertNotIncludes(c, 'Skip to next occurrence');
  c = caps(boardCardHtml(mk({ dueDate: '2030-03-04', repeat: 'daily' }))); assertNotIncludes(c, 'title="Set due date"', 'a card with a date edits it by clicking the date'); assertIncludes(c, 'Skip to next occurrence');
  assertIncludes(c, "openCellPop(event,'t1','status')");
});

test('a scrolling board column makes its cards ignore the pointer (no hover repaints), but not during a card drag', function () {
  const col = { classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } } };
  col.classList.add('board-col-body');
  boardScrollHover({ target: col }); assertTrue(col.classList.contains('is-scrolling'), 'scrolling: cards ignore the pointer'); clearTimeout(col._scrollT); col.classList.remove('is-scrolling');
  draggingTaskId = 't1'; boardScrollHover({ target: col }); assertFalse(col.classList.contains('is-scrolling'), 'a drag keeps its drop targets'); draggingTaskId = null;
  const other = { classList: { contains: () => false, add() { throw new Error('touched'); } } };
  boardScrollHover({ target: other }); boardScrollHover({ target: null });   // any other scroll (the list, a panel, the page) is left alone
});

test('board subtasks are indented to the title\'s text column (28px = the checkbox column), and a step is a further 21px in', function () {
  const t = { id: 't1', title: 'Parent', projectId: 'proj-inbox', status: 'todo', priority: 'medium', tags: [], dueDate: null, repeat: 'none', createdAt: 1, updatedAt: 1, subtasks: [{ id: 's1', text: 'Sub', done: false, subtasks: [{ id: 'ss1', text: 'Step', done: false, subtasks: [] }] }] };
  const h = boardCardHtml(t);
  assertIncludes(h, '<div class="task-subtasks" style="margin-left:28px">', 'the first level');
  assertIncludes(h, '<div class="task-subtasks" style="margin-left:21px">', 'steps step in from there');
});

test('board arrow keys keep working with the task panel open: they move the selection and the panel together', function () {
  tasks = ['a', 'b'].map(function (n, i) { return { id: 'bk' + n, title: n, notes: '', projectId: 'proj-inbox', status: 'todo', priority: 'medium', dueDate: null, tags: [], subtasks: [], createdAt: i, updatedAt: i }; });
  normalizeData(); viewMode = 'board'; render();
  var col = getBoardColumns().find(function (c) { return c.tasks.length === 2; }), first = col.tasks[0].id, second = col.tasks[1].id;
  kbdSelectedTaskId = first; openTask(first);
  var evt = { key: 'ArrowDown', preventDefault: function () {}, stopPropagation: function () {} };
  handleBoardKeyNav(evt);
  assertEqual(kbdSelectedTaskId, second, 'the selection moved down');
  assertEqual(activeTaskId, second, 'and the panel followed it');
  var enter = { key: 'Enter', preventDefault: function () {}, stopPropagation: function () {} };
  handleBoardKeyNav(enter);
  assertEqual(activeTaskId, second, 'other keys are still ignored while the panel is open');
});
