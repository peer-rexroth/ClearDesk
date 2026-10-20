// deleteProject() moves active tasks to Inbox for triage, but routes
// completed tasks to the hidden 'proj-deleted' pseudo-project instead —
// see visibleProjects(), which excludes it from the sidebar, board columns,
// and every project-assignment dropdown. Un-completing a task in
// proj-deleted sends it back to Inbox.

function fixtureForDelete(){
  tasks = [
    { id: 'active1', title: 'Still open', projectId: 'proj-work', status: 'todo', priority: 'medium', subtasks: [], tags: [] },
    { id: 'done1', title: 'Wrapped up', projectId: 'proj-work', status: 'done', priority: 'medium', subtasks: [], tags: [], completedAt: 1 }
  ];
}

test('deleteProject routes active tasks to Inbox', function () {
  fixtureForDelete();
  deleteProject('proj-work');
  assertEqual(tasks.find(x => x.id === 'active1').projectId, 'proj-inbox');
});

test('deleteProject routes completed tasks to proj-deleted', function () {
  fixtureForDelete();
  deleteProject('proj-work');
  const t = tasks.find(x => x.id === 'done1');
  assertEqual(t.projectId, 'proj-deleted');
  assertEqual(t.status, 'done');
});

test('proj-deleted is excluded from the sidebar project list', function () {
  assertFalse(visibleProjects().some(p => p.id === 'proj-deleted'));
  assertTrue(projects.some(p => p.id === 'proj-deleted'), 'the project should still exist so task references stay valid');
});

test('proj-deleted gets no board column', function () {
  fixtureForDelete();
  deleteProject('proj-work');
  const cols = getBoardColumns();
  assertFalse(cols.some(c => c.project.id === 'proj-deleted'));
});

test('routed completed tasks stay visible with no project filter (All Tasks)', function () {
  fixtureForDelete();
  deleteProject('proj-work');
  filterProjectId = null;
  assertTrue(taskMatchesFilters(tasks.find(x => x.id === 'done1')));
});

test('deleteProject bumps updatedAt on tasks it reassigns, so a later merge does not resurrect the deleted project onto them', function () {
  fixtureForDelete();
  tasks.forEach(t => { t.updatedAt = 1; });
  deleteProject('proj-work');
  assertTrue(tasks.find(x => x.id === 'active1').updatedAt > 1, 'reassigned task should get a fresh updatedAt, matching every other projectId-changing function');
  assertTrue(tasks.find(x => x.id === 'done1').updatedAt > 1);
});

test('undoing a project delete restores the original project on both tasks', function () {
  fixtureForDelete();
  deleteProject('proj-work');
  triggerToastUndo();
  assertEqual(tasks.find(x => x.id === 'done1').projectId, 'proj-work');
  assertEqual(tasks.find(x => x.id === 'active1').projectId, 'proj-work');
  assertTrue(!!projById('proj-work'), 'project should be restored');
});

test('un-completing a task in proj-deleted (via toggleTaskDone) sends it to Inbox', function () {
  fixtureForDelete();
  deleteProject('proj-work');
  toggleTaskDone('done1');
  const t = tasks.find(x => x.id === 'done1');
  assertEqual(t.status, 'todo');
  assertEqual(t.projectId, 'proj-inbox');
});

test('un-completing a task in proj-deleted (via updateTaskField status) sends it to Inbox', function () {
  fixtureForDelete();
  deleteProject('proj-work');
  updateTaskField('done1', 'status', 'todo');
  const t = tasks.find(x => x.id === 'done1');
  assertEqual(t.projectId, 'proj-inbox');
});

test('updateTaskField refuses to assign a task to proj-deleted directly', function () {
  fixtureForDelete();
  updateTaskField('active1', 'projectId', 'proj-deleted');
  assertEqual(tasks.find(x => x.id === 'active1').projectId, 'proj-work', 'projectId should be unchanged');
});

test('bulkMoveProject refuses to move tasks into proj-deleted', function () {
  fixtureForDelete();
  selectedTaskIds = new Set(['active1']);
  bulkMoveProject('proj-deleted');
  assertEqual(tasks.find(x => x.id === 'active1').projectId, 'proj-work', 'projectId should be unchanged');
});

test('drawer project select options omit proj-deleted', function () {
  fixtureForDelete();
  openTask('active1');
  const html = document.getElementById('drawer').innerHTML;
  assertFalse(html.includes("value=\"proj-deleted\""), 'proj-deleted should not be an assignable option in the drawer');
});
