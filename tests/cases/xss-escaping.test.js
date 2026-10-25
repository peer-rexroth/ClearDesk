// Regression coverage for the security review's date-field finding:
// t.dueDate/t.repeatEndDate were interpolated raw into the drawer's
// <input value="..."> attributes, with no esc() and no shape validation in
// normalizeData() — a malicious value from an imported/synced file broke
// out of the attribute the moment that task's drawer was opened.

test('drawer never puts a malicious dueDate into the markup (the Due row shows formatted, escaped text)', function () {
  tasks = [{ id: 't1', title: 'T', projectId: 'proj-inbox', status: 'todo', priority: 'medium', subtasks: [], tags: [], dueDate: '"><img src=x onerror=alert(1)>' }];
  openTask('t1');
  const html = document.getElementById('drawer').innerHTML;
  assertNotIncludes(html, '"><img src=x onerror=alert(1)>');
  assertNotIncludes(html, '<img');
});

test('drawer escapes a malicious repeatEndDate before putting it in the date input value attribute', function () {
  tasks = [{ id: 't1', title: 'T', projectId: 'proj-inbox', status: 'todo', priority: 'medium', subtasks: [], tags: [], repeat: 'daily', repeatEndDate: '"><img src=x onerror=alert(1)>' }];
  openTask('t1');
  const html = document.getElementById('drawer').innerHTML;
  assertNotIncludes(html, '"><img src=x onerror=alert(1)>');
  assertIncludes(html, '&quot;');
});
