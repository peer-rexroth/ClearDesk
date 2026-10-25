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
  assertEqual(localStorage.getItem('cleardesk_boardgroup'), 'status');
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
  assertIncludes(one, 'Open Details');
  assertIncludes(one, 'Add Subtask');
  assertIncludes(one, 'Duplicate');
  const many = rowMenuHtml(['a', 'b']);
  assertFalse(many.includes('Open Details'));
  assertIncludes(many, 'Delete 2 Tasks');
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
  try { quickAddProjectId = id; fn(); } finally { quickAddProjectId = prev; localStorage.removeItem('cleardesk_quickadd_project'); }
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
    assertEqual(localStorage.getItem('cleardesk_quickadd_project'), 'proj-personal');
    setQuickAddProject('proj-inbox');
    assertEqual(quickAddProjectId, null);
    assertEqual(localStorage.getItem('cleardesk_quickadd_project'), null);
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
  assertEqual(localStorage.getItem('cleardesk_sidebar_collapsed'), '1');
  toggleSidebar();
  assertFalse(sidebarCollapsed);
  assertFalse(document.documentElement.classList.contains('sidebar-collapsed'));
  assertEqual(localStorage.getItem('cleardesk_sidebar_collapsed'), '0');
});
test('Cmd/Ctrl+B toggles the sidebar in Tasks; other B combos and plain B do not', function () {
  appMode = 'tasks'; sidebarCollapsed = false;
  let prevented = false;
  handleSidebarShortcut({ key: 'b', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, preventDefault() { prevented = true; } });
  assertTrue(sidebarCollapsed); assertTrue(prevented);
  handleSidebarShortcut({ key: 'b', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, preventDefault() {} });
  assertTrue(sidebarCollapsed, 'plain b must not toggle');
  handleSidebarShortcut({ key: 'b', ctrlKey: true, metaKey: false, shiftKey: true, altKey: false, preventDefault() {} });
  assertTrue(sidebarCollapsed, 'Ctrl+Shift+B must not toggle');
  sidebarCollapsed = false; applySidebarState();
  localStorage.removeItem('cleardesk_sidebar_collapsed');
});
test('in Notes Cmd/Ctrl+B is left alone (it is Bold) and Alt+Cmd+S toggles the sidebar', function () {
  appMode = 'notes'; sidebarCollapsed = false;
  let prevented = false;
  handleSidebarShortcut({ key: 'b', ctrlKey: false, metaKey: true, shiftKey: false, altKey: false, preventDefault() { prevented = true; } });
  assertFalse(sidebarCollapsed, 'Cmd+B must not toggle the sidebar in Notes'); assertFalse(prevented, 'and must not be swallowed, so Bold works');
  handleSidebarShortcut({ key: 'ß', code: 'KeyS', ctrlKey: false, metaKey: true, shiftKey: false, altKey: true, preventDefault() { prevented = true; } });
  assertTrue(sidebarCollapsed); assertTrue(prevented);
  appMode = 'tasks'; sidebarCollapsed = false; applySidebarState();
  localStorage.removeItem('cleardesk_sidebar_collapsed');
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
  assertIncludes(toolMenuHtml('due'), 'Next Week');
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

test('the shortcuts dialog is built from groups, each with a label, an icon and rows of [label, keys]', function () {
  var g = shortcutGroups();
  assertTrue(g.length >= 4, 'several groups');
  g.forEach(function (grp) {
    assertTrue(!!grp.id && !!grp.label && !!grp.icon, 'group has id, label, icon');
    grp.rows.forEach(function (r) { assertTrue(typeof r[0] === 'string' && r[1].length > 0, 'row is [label, keys]'); });
  });
  assertTrue(scRowHtml(['Open selected task', ['↵']]).indexOf('<kbd>') !== -1, 'keys render as kbd');
});

test('the confirm dialog names its action: Delete by default, Unlink / Restore where that is what it does', function () {
  var btn = document.getElementById('confirmModalBtn');
  openConfirmModal({ title: 'Delete task?', body: 'x', action: function () {} });
  assertEqual(btn.textContent, 'Delete');
  assertEqual(btn.className, 'btn btn-danger');
  openConfirmModal({ title: 'Unlink file?', body: 'x', action: function () {}, confirmLabel: 'Unlink' });
  assertEqual(btn.textContent, 'Unlink');
  assertEqual(btn.className, 'btn btn-danger', 'unlinking stays a red, cautionary button');
  openConfirmModal({ title: 'Restore this backup?', body: 'x', action: function () {}, confirmLabel: 'Restore', danger: false });
  assertEqual(btn.textContent, 'Restore');
  assertEqual(btn.className, 'btn btn-primary');
  openConfirmModal({ title: 'Delete task?', body: 'x', action: function () {} });
  assertEqual(btn.textContent, 'Delete', 'the label resets for the next dialog');
});

// ── Tasks sidebar project menu (F-09) ────────────────────────────────────────
test('projectMenuHtml offers New Task Here and Edit for every project, and Delete only for unlocked ones', function () {
  const locked = projects.find(p => p.locked), free = projects.find(p => !p.locked);
  const a = projectMenuHtml(locked.id);
  assertIncludes(a, 'New Task Here'); assertIncludes(a, 'Edit'); assertIncludes(a, 'Delete'); assertIncludes(a.slice(a.indexOf('Delete') - 600, a.indexOf('Delete')), 'disabled', 'the locked Inbox shows Delete dimmed, not hidden');
  const b = projectMenuHtml(free.id);
  assertIncludes(b, 'New Task Here'); assertIncludes(b, 'Edit'); assertIncludes(b, 'Delete');
  assertEqual(projectMenuHtml('nope'), '');
});

test('undoable deletes do not ask: the item goes and the toast offers Undo; errors are announced as alerts', function () {
  tasks = [{ id: 'q1', title: 'x', projectId: 'proj-inbox', status: 'todo', priority: 'medium', tags: [], subtasks: [] }];
  modalTarget = null; toastUndoAction = null;
  deleteTask('q1');
  assertEqual(tasks.length, 0, 'deleted without a dialog'); assertEqual(modalTarget, null);
  assertTrue(typeof toastUndoAction === 'function', 'Undo is offered');
  toastUndoAction(); assertEqual(tasks.length, 1);
  showToast('Something failed', true);
  assertEqual(document.getElementById('toast').getAttribute('role'), 'alert');
  showToast('Saved');
  assertEqual(document.getElementById('toast').getAttribute('role'), 'status');
});

test('mode shortcuts: Option+Command+1/2/3 (Ctrl+Alt on other systems) pick Tasks, Notes and Prompts; plain ⌘1–3 and other combinations do nothing', function () {
  assertEqual(modeShortcutOf({ altKey: true, metaKey: true, code: 'Digit1' }), 'tasks');
  assertEqual(modeShortcutOf({ altKey: true, ctrlKey: true, code: 'Digit2' }), 'notes');
  assertEqual(modeShortcutOf({ altKey: true, metaKey: true, code: 'Digit3' }), 'prompts');
  assertEqual(modeShortcutOf({ metaKey: true, code: 'Digit1' }), null, 'plain ⌘1 is the browser\'s');
  assertEqual(modeShortcutOf({ altKey: true, metaKey: true, shiftKey: true, code: 'Digit1' }), null);
  assertEqual(modeShortcutOf({ altKey: true, metaKey: true, code: 'Digit4' }), null);
  var seen = null, orig = setAppMode; setAppMode = function (m) { seen = m; };
  var pd = false; handleSidebarShortcut({ altKey: true, metaKey: true, code: 'Digit2', key: '2', preventDefault: function () { pd = true; } });
  setAppMode = orig;
  assertEqual(seen, 'notes'); assertTrue(pd);
});

test('the sidebar cannot be made narrower than its bottom tools bar needs', function () {
  assertEqual(clampSidebarW(100), 260); assertEqual(clampSidebarW(259), 260); assertEqual(clampSidebarW(300), 300); assertEqual(clampSidebarW(999), 480);
});

test('launch shortcuts: ?new=task | note | prompt are recognised, anything else is ignored', function () {
  assertEqual(launchActionOf('?new=task'), 'task'); assertEqual(launchActionOf('?new=note'), 'note'); assertEqual(launchActionOf('?a=1&new=prompt'), 'prompt');
  assertEqual(launchActionOf('?new=notes'), null); assertEqual(launchActionOf('?new='), null); assertEqual(launchActionOf(''), null); assertEqual(launchActionOf(undefined), null);
});

test('the new-version check compares the server headers (ETag first, then Last-Modified, then length) and shows a banner that stays until dismissed', function () {
  var H = function (o) { return { get: function (k) { return o[k] || null; } }; };
  assertEqual(versionStampOf(H({ etag: '"a1"', 'last-modified': 'x' })), '"a1"'); assertEqual(versionStampOf(H({ 'last-modified': 'Tue' })), 'Tue');
  assertEqual(versionStampOf(H({ 'content-length': '770000' })), '770000'); assertEqual(versionStampOf(H({})), ''); assertEqual(versionStampOf(null), '');
  updateBannerDismissed = false; showUpdateBanner();
  var el = document.getElementById('updateBanner'); assertIncludes(el.innerHTML, 'new version'); assertIncludes(el.innerHTML, 'Reload');
  dismissUpdateBanner(); assertEqual(el.innerHTML, ''); showUpdateBanner(); assertEqual(el.innerHTML, '', 'once dismissed it stays away this session');
  updateBannerDismissed = false;
});

test('the task panel is a grouped inspector: rows with a label and a value, a real select over each pop-up row, Due through the shared popover, a quiet Delete', function () {
  tasks = [{ id: 't1', title: 'T', projectId: 'proj-inbox', status: 'doing', priority: 'high', subtasks: [], tags: [], dueDate: '2030-01-05', repeat: 'weekly', repeatEndDate: '2031-02-03' }];
  openTask('t1');
  const h = document.getElementById('drawer').innerHTML;
  ['Project', 'Status', 'Priority', 'Due', 'Repeat', 'Every', 'On days', 'Ends on', 'After', 'Tags'].forEach(k => assertIncludes(h, '<span class="k">' + k, k + ' is a row'));
  assertEqual(h.split('class="drow-sel"').length - 1, 4, 'Project, Status, Priority and Repeat each keep a real select');
  assertIncludes(h, "openCellPop(event,'t1','due')"); assertIncludes(h, 'role="button" tabindex="0" aria-haspopup="menu" aria-label="Due date"');
  assertIncludes(h, 'class="drow-ov" type="date"'); assertIncludes(h, 'value="2031-02-03"');
  assertIncludes(h, '<div class="dsec"><span>Subtasks</span>');
  assertIncludes(h, 'btn-text-danger'); assertNotIncludes(h, 'btn-danger"');
  assertNotIncludes(h, '<label>Notes</label>'); assertNotIncludes(h, 'resize');
});

test('the panel rows follow the data: a repeating task shows its details, a plain one does not; an overdue date is flagged', function () {
  tasks = [{ id: 't1', title: 'T', projectId: 'proj-inbox', status: 'todo', priority: 'low', subtasks: [], tags: [], dueDate: '2000-01-01' }];
  openTask('t1');
  let h = document.getElementById('drawer').innerHTML;
  assertNotIncludes(h, '<span class="k">Every'); assertIncludes(h, 'class="v overdue"');
  tasks[0].repeat = 'daily'; tasks[0].dueDate = null; renderDrawer(); h = document.getElementById('drawer').innerHTML;
  assertIncludes(h, '<span class="k">Every'); assertIncludes(h, 'drow-skip'); assertNotIncludes(h, 'class="v overdue"'); assertIncludes(h, '<span class="vt">None</span>');
});

test('the multi-select bar is gone: no render function, and Repeat (the one thing only it could set) is in the right-click menu for one or many tasks', function () {
  assertEqual(typeof renderBulkBar, 'undefined');
  const mk = (id, extra) => Object.assign({ id, title: id, projectId: 'proj-inbox', status: 'todo', priority: 'medium', subtasks: [], tags: [], dueDate: '2030-01-05', createdAt: 1, updatedAt: 1 }, extra || {});
  tasks = [mk('a'), mk('b', { repeat: 'daily' })];
  const h = rowMenuHtml(['a', 'b']);
  assertIncludes(h, '>Repeat<'); assertIncludes(h, "rowMenuRun('repeat','weekly')"); assertIncludes(h, "rowMenuRun('repeat','none')");
  const flyout = html => { const i = html.indexOf('<span>Repeat</span>'); return html.slice(i, html.indexOf('</div></div>', i)); };
  assertNotIncludes(flyout(h), 'menu-opt current', 'two tasks that differ show no ✓ in the Repeat list');
  rowMenuIds = ['a', 'b']; rowMenuRun('repeat', 'weekly');
  assertEqual(tasks[0].repeat, 'weekly'); assertEqual(tasks[1].repeat, 'weekly', 'one choice applies to the whole selection');
  rowMenuIds = ['a']; rowMenuRun('repeat', 'none'); assertEqual(tasks[0].repeat, 'none'); assertEqual(tasks[1].repeat, 'weekly', 'a single task changes alone');
  const one = rowMenuHtml(['b']); assertIncludes(flyout(one), "menu-opt current\" role=\"menuitem\" onclick=\"rowMenuRun('repeat','weekly')", 'one task shows its own repeat ticked (b is weekly by now)'); assertNotIncludes(flyout(one), 'no-tick');
});

test('a Shift-click on a row or card does not start the browser\'s own text selection; other clicks and text fields are left alone', function () {
  const ev = (o, inside) => { const e = { shiftKey: !!o.shift, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, target: { closest: sel => inside.some(s => sel.indexOf(s) !== -1) ? {} : null } }; return e; };
  let e = ev({ shift: true }, ['.task-row']); rowShiftMouseDown(e); assertTrue(e.defaultPrevented, 'Shift-click on a task row');
  e = ev({ shift: true }, ['.board-card']); rowShiftMouseDown(e); assertTrue(e.defaultPrevented, 'and on a board card');
  e = ev({ shift: false }, ['.task-row']); rowShiftMouseDown(e); assertFalse(e.defaultPrevented, 'a plain press is untouched (text can still be selected / dragged)');
  e = ev({ shift: true }, []); rowShiftMouseDown(e); assertFalse(e.defaultPrevented, 'outside the list nothing changes');
  e = ev({ shift: true }, ['.task-row', 'input']); rowShiftMouseDown(e); assertFalse(e.defaultPrevented, 'a rename field inside a row keeps Shift+click for selecting its text');
});

test('the per-row action capsule is hidden on the selected rows only while several are selected: the multi-sel flag follows the selection size', function () {
  const mk = id => ({ id, title: id, projectId: 'proj-inbox', status: 'todo', priority: 'medium', subtasks: [], tags: [], createdAt: 1, updatedAt: 1 });
  tasks = [mk('a'), mk('b'), mk('c')];
  const on = () => document.documentElement.classList.contains('multi-sel');
  selectedTaskIds = new Set(['a']); kbdSelectedTaskId = 'a'; updateSelectionToolbar(); assertFalse(on(), 'one selected: the capsule stays');
  selectedTaskIds = new Set(['a', 'b']); updateSelectionToolbar(); assertTrue(on(), 'two selected: hidden on them');
  selectedTaskIds = new Set(); kbdSelectedTaskId = 'c'; updateSelectionToolbar(); assertFalse(on(), 'selection cleared: back');
});

test('the selection is accent only while its list is the active area: zones from where the pointer / focus is, grey otherwise', function () {
  const el = (...zones) => ({ closest: sel => sel.split(',').map(x => x.trim()).some(x => zones.indexOf(x) !== -1) ? {} : null });
  assertEqual(selZoneOf(el('.main')), 'list', 'the task list');
  assertEqual(selZoneOf(el('.notes-list-pane')), 'list', 'the notes / prompts list');
  assertEqual(selZoneOf(el('#drawer')), 'other', 'the task panel');
  assertEqual(selZoneOf(el('.notes-editor-pane')), 'other', 'the note / prompt editor');
  assertEqual(selZoneOf(el('.sidebar')), 'other', 'the sidebar (search, projects)');
  assertEqual(selZoneOf(el('.main', '.quickadd')), 'other', 'the quick-add field lives inside .main but is not the list');
  assertEqual(selZoneOf(el('.main', '.modal-bg')), null, 'a dialog leaves the state as it was');
  assertEqual(selZoneOf(el('.main', '#rowMenu')), null, 'so does a menu');
  assertEqual(selZoneOf(el()), null); assertEqual(selZoneOf(null), null);
  const inactive = () => document.documentElement.classList.contains('sel-inactive');
  selZone = 'list'; selWinActive = true; applySelActive(); assertFalse(inactive(), 'list active, window active');
  setSelZone('other'); assertTrue(inactive(), 'focus moved to the panel');
  setSelZone(null); assertTrue(inactive(), 'an unknown target changes nothing');
  setSelZone('list'); assertFalse(inactive(), 'back in the list');
  selWinActive = false; applySelActive(); assertTrue(inactive(), 'another window is active');
  selWinActive = true; applySelActive(); assertFalse(inactive());
  selectTaskInList; setSelZone('other'); closeDrawer(); assertFalse(inactive(), 'closing the panel hands the selection back to the list');
});

test('typing in a text field turns the selection grey even inside the list, and it comes back when the field is gone', function () {
  const inactive = () => document.documentElement.classList.contains('sel-inactive');
  const field = { closest: sel => sel.indexOf('input') !== -1 ? {} : null }, none = { closest: () => null };
  selZone = 'list'; selWinActive = true;
  document.activeElement = none; applySelActive(); assertFalse(inactive(), 'nothing focused: the list is active');
  document.activeElement = field; applySelActive(); assertTrue(inactive(), 'a rename / add-subtask field has focus');
  document.activeElement = none; updateSelectionToolbar(); assertFalse(inactive(), 'the field is gone (a re-render removes it with no blur): blue again');
  document.activeElement = { closest: sel => sel.indexOf('[contenteditable="true"]') !== -1 ? {} : null }; applySelActive(); assertTrue(inactive(), 'the note body counts too');
  document.activeElement = none; applySelActive();
});
