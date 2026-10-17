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

test('a plain click on a list row only selects it; the drawer needs a double-click', function () {
  tasks = [uxTask()];
  handleRowClick({ shiftKey: false, ctrlKey: false, metaKey: false }, 'u1');
  assertEqual(activeTaskId, null);
  assertEqual(kbdSelectedTaskId, 'u1');
  openTask('u1');   // what the row's ondblclick calls
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

// ── Row menu, side panel, linked-file chip ───────────────────────────────────
test('bulk helpers act on an explicit id list and leave the selection alone', function () {
  tasks = [uxTask({ id: 'a' }), uxTask({ id: 'b' }), uxTask({ id: 'c' })];
  selectedTaskIds = new Set();
  bulkSetPriority('high', ['a', 'c']);
  assertEqual(tasks.find(t => t.id === 'a').priority, 'high');
  assertEqual(tasks.find(t => t.id === 'b').priority, 'medium');
  assertEqual(tasks.find(t => t.id === 'c').priority, 'high');
  assertEqual(selectedTaskIds.size, 0, 'a row-menu action must not create a selection');
});

test('rowMenuRun on a single row changes just that task through updateTaskField', function () {
  tasks = [uxTask({ id: 'a' }), uxTask({ id: 'b' })];
  rowMenuIds = ['a'];
  rowMenuRun('status', 'doing');
  assertEqual(tasks[0].status, 'doing');
  assertEqual(tasks[1].status, 'todo');
});

test('rowMenuRun due shortcuts set today / tomorrow / next week / clear', function () {
  tasks = [uxTask({ id: 'a' })];
  rowMenuIds = ['a']; rowMenuRun('due', 'tomorrow');
  assertEqual(tasks[0].dueDate, isoAddDays(todayStr(), 1));
  rowMenuIds = ['a']; rowMenuRun('due', 'week');
  assertEqual(tasks[0].dueDate, isoAddDays(todayStr(), 7));
  rowMenuIds = ['a']; rowMenuRun('due', 'clear');
  assertEqual(tasks[0].dueDate, null);
});

test('the menus\' date field sets any date on one or several tasks, and an empty value clears it', function () {
  tasks = [uxTask({ id: 'a' }), uxTask({ id: 'b', dueDate: '2030-01-01' })];
  rowMenuIds = ['a']; rowMenuRun('due', '2031-03-03');
  assertEqual(tasks[0].dueDate, '2031-03-03');
  rowMenuIds = ['a', 'b']; rowMenuRun('due', '2032-04-04');
  assertEqual(tasks[0].dueDate, '2032-04-04');
  assertEqual(tasks[1].dueDate, '2032-04-04');
  rowMenuIds = ['a', 'b']; rowMenuRun('due', 'clear');
  assertEqual(tasks[0].dueDate, null);
  assertEqual(tasks[1].dueDate, null);
});

test('the right-click Due submenu and the toolbar Due menu both offer the date field, prefilled when the selection shares a date', function () {
  tasks = [uxTask({ id: 'a', dueDate: '2031-03-03' }), uxTask({ id: 'b', dueDate: '2031-03-03' })];
  kbdSelectedTaskId = 'a'; selectedTaskIds = new Set(['a', 'b']);
  var tool = toolMenuHtml('due');
  assertTrue(tool.indexOf('type="date"') !== -1 && tool.indexOf('value="2031-03-03"') !== -1, 'toolbar Due menu has a prefilled date field');
  var menu = rowMenuHtml(['a', 'b']);
  assertTrue(menu.indexOf('type="date"') !== -1 && menu.indexOf('value="2031-03-03"') !== -1, 'row menu Due submenu has a prefilled date field');
  tasks[1].dueDate = '2031-05-05';
  assertTrue(toolMenuHtml('due').indexOf('value="2031-03-03"') === -1, 'no prefill when the selection disagrees');
});

test('rowMenuRun on several rows applies to all of them', function () {
  tasks = [uxTask({ id: 'a' }), uxTask({ id: 'b' }), uxTask({ id: 'c' })];
  rowMenuIds = ['a', 'b'];
  rowMenuRun('project', 'proj-work');
  assertEqual(tasks[0].projectId, 'proj-work');
  assertEqual(tasks[1].projectId, 'proj-work');
  assertEqual(tasks[2].projectId, 'proj-inbox');
});

test('rowMenuRun toggledone completes a mixed selection, then reopens it', function () {
  tasks = [uxTask({ id: 'a', status: 'done' }), uxTask({ id: 'b' })];
  rowMenuIds = ['a', 'b']; rowMenuRun('toggledone');
  assertTrue(tasks.every(t => t.status === 'done'));
  rowMenuIds = ['a', 'b']; rowMenuRun('toggledone');
  assertTrue(tasks.every(t => t.status === 'todo'));
});

test('rowMenuHtml offers single-task items only for one row', function () {
  tasks = [uxTask({ id: 'a' }), uxTask({ id: 'b' })];
  const one = rowMenuHtml(['a']);
  assertIncludes(one, 'Open details');
  assertIncludes(one, 'Add subtask');
  assertIncludes(one, 'Duplicate');
  const many = rowMenuHtml(['a', 'b']);
  assertFalse(many.includes('Open details'));
  assertIncludes(many, 'Delete 2 tasks');
});

test('opening the row menu does not change the selection', function () {
  tasks = [uxTask({ id: 'a' })];
  selectedTaskIds = new Set();
  showRowMenu('a', 10, 10, null);
  assertEqual(selectedTaskIds.size, 0);
  assertDeepEqual(rowMenuIds, ['a']);
});

test('a right-click on a row inside a multi-selection targets the whole selection', function () {
  tasks = [uxTask({ id: 'a' }), uxTask({ id: 'b' }), uxTask({ id: 'c' })];
  selectedTaskIds = new Set(['a', 'b']);
  showRowMenu('a', 10, 10, null);
  assertDeepEqual(rowMenuIds, ['a', 'b']);
  showRowMenu('c', 10, 10, null);
  assertDeepEqual(rowMenuIds, ['c']);
});

test('fileSyncChipHtml renders the three Milestone-style states', function () {
  assertIncludes(fileSyncChipHtml('unlinked'), 'Link file');
  assertIncludes(fileSyncChipHtml('unlinked'), 'warn');
  assertIncludes(fileSyncChipHtml('linked', 'my.json'), 'Linked');
  assertIncludes(fileSyncChipHtml('linked', 'my.json'), 'my.json');
  assertIncludes(fileSyncChipHtml('lapsed', 'my.json'), 'Reconnect');
});

test('the side panel stays open and follows the selection with the arrow keys', function () {
  tasks = [uxTask({ id: 'a' }), uxTask({ id: 'b' })];
  sortBy = 'created';
  openTask('a');
  const first = getVisibleListTasks().tasks[0].id;
  kbdSelectedTaskId = first;
  handleListKeyNav({ key: 'ArrowDown', preventDefault() {}, shiftKey: false });
  assertEqual(activeTaskId, kbdSelectedTaskId, 'the panel should show the newly selected task');
  assertTrue(kbdSelectedTaskId !== first);
});

// ── Default project for quick-add ────────────────────────────────────────────
function uxWithQuickAddDefault(id, fn) {
  const prev = quickAddProjectId;
  try { quickAddProjectId = id; fn(); } finally { quickAddProjectId = prev; localStorage.removeItem('mytasks_quickadd_project'); }
}
test('quick-add uses the chosen default project from All Tasks', function () {
  uxWithQuickAddDefault('proj-work', function () {
    assertEqual(uxQuickAdd('Standup notes').projectId, 'proj-work');
  });
});
test('quick-add defaults to Inbox when no default is set', function () {
  uxWithQuickAddDefault(null, function () {
    assertEqual(uxQuickAdd('Loose idea').projectId, 'proj-inbox');
  });
});
test('the project you are viewing beats the default, and #project beats both', function () {
  uxWithQuickAddDefault('proj-work', function () {
    filterProjectId = 'proj-personal';
    assertEqual(uxQuickAdd('Buy stamps').projectId, 'proj-personal');
    assertEqual(uxQuickAdd('Buy milk #work').projectId, 'proj-work');
  });
});
test('a default project that no longer exists falls back to Inbox', function () {
  uxWithQuickAddDefault('proj-gone', function () {
    assertEqual(quickAddDefaultProjectId(), 'proj-inbox');
    assertEqual(uxQuickAdd('Orphan').projectId, 'proj-inbox');
  });
});
test('setQuickAddProject persists the choice and clears it for Inbox or junk', function () {
  uxWithQuickAddDefault(null, function () {
    setQuickAddProject('proj-personal');
    assertEqual(quickAddProjectId, 'proj-personal');
    assertEqual(localStorage.getItem('mytasks_quickadd_project'), 'proj-personal');
    setQuickAddProject('proj-inbox');
    assertEqual(quickAddProjectId, null);
    assertEqual(localStorage.getItem('mytasks_quickadd_project'), null);
    setQuickAddProject('not-a-project');
    assertEqual(quickAddProjectId, null);
  });
});
test('setQuickAddProject refuses the system-managed Deleted project', function () {
  uxWithQuickAddDefault(null, function () {
    setQuickAddProject('proj-deleted');
    assertEqual(quickAddProjectId, null);
  });
});

// ── Sortable column headers ──────────────────────────────────────────────────
function uxSortedIds() { return getFilteredSortedTasks().map(t => t.id); }
function uxSortFixture() {
  tasks = [
    uxTask({ id: 'a', title: 'Bravo',   priority: 'low',    dueDate: '2031-02-01', projectId: 'proj-work',     status: 'doing' }),
    uxTask({ id: 'b', title: 'alpha',   priority: 'high',   dueDate: null,         projectId: 'proj-inbox',    status: 'todo' }),
    uxTask({ id: 'c', title: 'Charlie', priority: 'medium', dueDate: '2031-01-01', projectId: 'proj-personal', status: 'todo' })
  ];
}
test('clicking a column header cycles ascending, descending, then back to Smart order', function () {
  sortBy = 'smart';
  sortByColumn('due');  assertEqual(sortBy, 'due');
  sortByColumn('due');  assertEqual(sortBy, 'due:desc');
  sortByColumn('due');  assertEqual(sortBy, 'smart');
  sortByColumn('due'); sortByColumn('alpha');
  assertEqual(sortBy, 'alpha', 'a different column starts ascending');
});
test('title, priority and project sort both ways', function () {
  uxSortFixture();
  sortBy = 'alpha';      assertDeepEqual(uxSortedIds(), ['b', 'a', 'c']);
  sortBy = 'alpha:desc'; assertDeepEqual(uxSortedIds(), ['c', 'a', 'b']);
  sortBy = 'priority';   assertDeepEqual(uxSortedIds(), ['b', 'c', 'a']);
  sortBy = 'priority:desc'; assertDeepEqual(uxSortedIds(), ['a', 'c', 'b']);
  sortBy = 'project';    assertDeepEqual(uxSortedIds(), ['b', 'c', 'a'], 'Inbox, Personal, Work');
  sortBy = 'project:desc'; assertDeepEqual(uxSortedIds(), ['a', 'c', 'b']);
});
test('due sorts both ways but always keeps undated tasks last', function () {
  uxSortFixture();
  sortBy = 'due';      assertDeepEqual(uxSortedIds(), ['c', 'a', 'b']);
  sortBy = 'due:desc'; assertDeepEqual(uxSortedIds(), ['a', 'c', 'b']);
});
test('status sorts to-do before in-progress, and completed tasks sink in both directions', function () {
  tasks = [uxTask({ id: 'x', title: 'X', status: 'done' }), uxTask({ id: 'y', title: 'Y', status: 'doing' }), uxTask({ id: 'z', title: 'Z', status: 'todo' })];
  sortBy = 'status';      assertDeepEqual(uxSortedIds(), ['z', 'y', 'x']);
  sortBy = 'status:desc'; assertDeepEqual(uxSortedIds(), ['y', 'z', 'x']);
});
test('an unknown sortBy falls back to Smart order instead of breaking the list', function () {
  uxSortFixture(); sortBy = 'bogus:desc';
  assertEqual(uxSortedIds().length, 3);
});
test('the sort dropdown shows the base column while a descending sort is active', function () {
  sortBy = 'due:desc'; renderSidebar();
  assertEqual(document.getElementById('sortSelect').value, 'due');
  sortBy = 'smart';
});

// ── Collapsible sidebar ──────────────────────────────────────────────────────
test('toggleSidebar flips the state, the html class, and persists the choice', function () {
  sidebarCollapsed = false; applySidebarState();
  toggleSidebar();
  assertTrue(sidebarCollapsed);
  assertTrue(document.documentElement.classList.contains('sidebar-collapsed'));
  assertEqual(localStorage.getItem('mytasks_sidebar_collapsed'), '1');
  toggleSidebar();
  assertFalse(sidebarCollapsed);
  assertFalse(document.documentElement.classList.contains('sidebar-collapsed'));
  assertEqual(localStorage.getItem('mytasks_sidebar_collapsed'), '0');
});
test('Cmd/Ctrl+B toggles the sidebar; other B combos and plain B do not', function () {
  sidebarCollapsed = false;
  let prevented = false;
  handleSidebarShortcut({ key: 'b', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, preventDefault() { prevented = true; } });
  assertTrue(sidebarCollapsed); assertTrue(prevented);
  handleSidebarShortcut({ key: 'b', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, preventDefault() {} });
  assertTrue(sidebarCollapsed, 'plain b must not toggle');
  handleSidebarShortcut({ key: 'b', ctrlKey: true, metaKey: false, shiftKey: true, altKey: false, preventDefault() {} });
  assertTrue(sidebarCollapsed, 'Ctrl+Shift+B must not toggle');
  sidebarCollapsed = false; applySidebarState();
  localStorage.removeItem('mytasks_sidebar_collapsed');
});

// ── Selection toolbar and counts ─────────────────────────────────────────────
test('selectionIds prefers the multi-selection, else the single selected row, else nothing', function () {
  tasks = [uxTask({ id: 'a' }), uxTask({ id: 'b' }), uxTask({ id: 'c' })];
  selectedTaskIds = new Set(); kbdSelectedTaskId = null;
  assertDeepEqual(selectionIds(), []);
  kbdSelectedTaskId = 'b';
  assertDeepEqual(selectionIds(), ['b']);
  selectedTaskIds = new Set(['a', 'c']);
  assertDeepEqual(selectionIds(), ['a', 'c']);
  selectedTaskIds = new Set(['gone']);
  assertDeepEqual(selectionIds(), [], 'ids of deleted tasks are ignored');
  selectedTaskIds = new Set(); kbdSelectedTaskId = null;
});
test('viewCounts counts open, overdue and done tasks in the current view', function () {
  tasks = [
    uxTask({ id: 'a' }),
    uxTask({ id: 'b', dueDate: '2000-01-01' }),
    uxTask({ id: 'c', status: 'done', dueDate: '2000-01-01' })
  ];
  const c = viewCounts();
  assertEqual(c.open, 2); assertEqual(c.overdue, 1, 'a done task is never overdue'); assertEqual(c.done, 1);
});
test('the subtitle reads "N open · M overdue" and adds the selection count for several rows', function () {
  tasks = [uxTask({ id: 'a' }), uxTask({ id: 'b', dueDate: '2000-01-01' }), uxTask({ id: 'c' })];
  selectedTaskIds = new Set(); kbdSelectedTaskId = null;
  assertEqual(mainSubtitleText(), '3 open · 1 overdue');
  kbdSelectedTaskId = 'a';
  assertEqual(mainSubtitleText(), '3 open · 1 overdue', 'one selected row is not announced');
  selectedTaskIds = new Set(['a', 'b']);
  assertEqual(mainSubtitleText(), '3 open · 1 overdue · 2 selected');
  selectedTaskIds = new Set(); kbdSelectedTaskId = null;
});
test('the subtitle handles an empty view and an all-done view', function () {
  tasks = [];
  assertEqual(mainSubtitleText(), 'No tasks');
  tasks = [uxTask({ id: 'a', status: 'done' }), uxTask({ id: 'b', status: 'done' })];
  assertEqual(mainSubtitleText(), '0 open · 2 done');
});
test('toolbarAct applies to the whole selection; with no selection it does nothing', function () {
  tasks = [uxTask({ id: 'a' }), uxTask({ id: 'b' }), uxTask({ id: 'c' })];
  selectedTaskIds = new Set(); kbdSelectedTaskId = null;
  toolbarAct('priority', 'high');
  assertTrue(tasks.every(t => t.priority === 'medium'), 'nothing selected, nothing changes');
  selectedTaskIds = new Set(['a', 'b']);
  toolbarAct('priority', 'high');
  assertEqual(tasks[0].priority, 'high'); assertEqual(tasks[1].priority, 'high'); assertEqual(tasks[2].priority, 'medium');
  selectedTaskIds = new Set(); kbdSelectedTaskId = 'c';
  toolbarAct('toggledone');
  assertEqual(tasks[2].status, 'done');
  kbdSelectedTaskId = null;
});
test('toolMenuHtml lists priorities, due shortcuts and projects', function () {
  PRIORITIES.forEach(p => assertIncludes(toolMenuHtml('priority'), p.label));
  assertIncludes(toolMenuHtml('due'), 'Next week');
  assertIncludes(toolMenuHtml('project'), 'Work');
});

test('Cmd/Ctrl+click extends the selection with the row selected by a plain click', function () {
  tasks = [uxTask({ id: 'a' }), uxTask({ id: 'b' }), uxTask({ id: 'c' })];
  selectedTaskIds = new Set(); kbdSelectedTaskId = 'a';
  handleRowClick({ shiftKey: false, ctrlKey: true, metaKey: false }, 'c');
  assertDeepEqual([...selectedTaskIds].sort(), ['a', 'c']);
  selectedTaskIds = new Set(); kbdSelectedTaskId = null;
});

// ── Selection changes must not rebuild the list or the panel ─────────────────
test('a plain click selects in place: the list markup is not rebuilt', function () {
  tasks = [uxTask({ id: 'a' }), uxTask({ id: 'b' })];
  document.getElementById('taskList').innerHTML = 'SENTINEL';
  handleRowClick({ shiftKey: false, ctrlKey: false, metaKey: false }, 'b');
  assertEqual(document.getElementById('taskList').innerHTML, 'SENTINEL');
  assertEqual(kbdSelectedTaskId, 'b');
  kbdSelectedTaskId = null;
});
test('modifier clicks and clearSelection also leave the list markup alone', function () {
  tasks = [uxTask({ id: 'a' }), uxTask({ id: 'b' })];
  selectedTaskIds = new Set(); kbdSelectedTaskId = null;
  document.getElementById('taskList').innerHTML = 'SENTINEL';
  handleRowClick({ shiftKey: false, ctrlKey: true, metaKey: false }, 'a');
  handleRowClick({ shiftKey: false, ctrlKey: true, metaKey: false }, 'b');
  assertDeepEqual([...selectedTaskIds].sort(), ['a', 'b']);
  clearSelection();
  assertEqual(selectedTaskIds.size, 0);
  assertEqual(document.getElementById('taskList').innerHTML, 'SENTINEL');
});
test('openTask rebuilds the panel only for a different task, never the list', function () {
  tasks = [uxTask({ id: 'a' }), uxTask({ id: 'b' })];
  activeTaskId = null; inlineAddSubtaskTaskId = null;
  document.getElementById('taskList').innerHTML = 'SENTINEL';
  openTask('a');
  assertEqual(activeTaskId, 'a');
  const drawer = document.getElementById('drawer');
  drawer.innerHTML = 'PANEL';
  openTask('a');
  assertEqual(drawer.innerHTML, 'PANEL', 'same task: the panel is left alone');
  openTask('b');
  assertTrue(drawer.innerHTML !== 'PANEL', 'a different task rebuilds the panel');
  assertEqual(document.getElementById('taskList').innerHTML, 'SENTINEL', 'the list is never rebuilt');
  activeTaskId = null; kbdSelectedTaskId = null;
});
test('openTask still rebuilds the list when an inline add-subtask input was open', function () {
  tasks = [uxTask({ id: 'a' })];
  activeTaskId = null; inlineAddSubtaskTaskId = 'a';
  document.getElementById('taskList').innerHTML = 'SENTINEL';
  openTask('a');
  assertEqual(inlineAddSubtaskTaskId, null);
  assertTrue(document.getElementById('taskList').innerHTML !== 'SENTINEL', 'the open input has to be removed from the markup');
  activeTaskId = null; kbdSelectedTaskId = null;
});

// ── Focus: release a select after a mouse choice, never after the keyboard ──
test('a select is released after a pointer-driven change but not a keyboard-driven one', function () {
  let blurred = 0;
  const sel = { tagName: 'SELECT', blur() { blurred++; } };
  noteInputModality({ type: 'pointerdown' });
  releaseSelectAfterPointerChange({ target: sel });
  assertEqual(blurred, 1, 'mouse choice releases focus');
  noteInputModality({ type: 'keydown' });
  releaseSelectAfterPointerChange({ target: sel });
  assertEqual(blurred, 1, 'stepping through options with the arrow keys keeps focus');
  noteInputModality({ type: 'pointerdown' });
  releaseSelectAfterPointerChange({ target: { tagName: 'INPUT', blur() { blurred++; } } });
  assertEqual(blurred, 1, 'only selects are affected');
  noteInputModality({ type: 'keydown' });
  const cl = document.documentElement.classList;
  noteInputModality({ type: 'pointerdown' });
  assertFalse(cl.contains('kbd-input'), 'a pointer press clears the keyboard-input flag');
  noteInputModality({ type: 'keydown' });
  assertTrue(cl.contains('kbd-input'), 'a key press sets it, which is what lets a select show its ring');
});

test('the Help dialog has a label for every topic, opens on the last topic read, and falls back to the first for an unknown one', function () {
  HELP_TABS.forEach(function (t) { assertTrue(!!HELP_TAB_LABELS[t], 'label for ' + t); });
  setHelpTab('views'); assertEqual(helpTab, 'views');
  setHelpTab('no-such-topic'); assertEqual(helpTab, HELP_TABS[0]);
  setHelpTab('data'); openHelpModal(); assertEqual(helpTab, 'data');
});

test('ArrowDown from the quick-add field selects the first task; ArrowUp from the first task clears the selection (focus returns to the field)', function () {
  tasks = [uxTask({ id: 'a', title: 'A' }), uxTask({ id: 'b', title: 'B' })];
  viewMode = 'list'; kbdSelectedTaskId = null; selectedTaskIds = new Set();
  var first = getVisibleListTasks().tasks[0].id;
  selectFirstTaskFromQuickAdd();
  assertEqual(kbdSelectedTaskId, first);
  var stopped = false, prevented = false;
  quickAddTask({ key: 'ArrowDown', preventDefault: function () { prevented = true; }, stopPropagation: function () { stopped = true; }, target: { value: '' } });
  assertTrue(prevented && stopped, 'the keypress is consumed so the list handler does not also move a row');
  leaveTasksToQuickAdd();
  assertEqual(kbdSelectedTaskId, null);
});
