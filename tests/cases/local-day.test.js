// "Today" is the local calendar day. toISOString() is UTC, so it reads a day early or late for an hour or two around local midnight
// (cross-app audit X-20); a task due today must not turn overdue, and a backup must not be dated, a day off.
test('dayStr reads the local calendar day, also just after local midnight', function(){
  assertEqual(dayStr(new Date(2026, 10, 2, 0, 30)), '2026-11-02');
  assertEqual(dayStr(new Date(2026, 10, 1, 23, 30)), '2026-11-01');
  assertEqual(dayStr(new Date(2026, 0, 5, 12, 0)), '2026-01-05');
});
test('todayStr is the local day of now', function(){
  assertEqual(todayStr(), dayStr(new Date()));
});
test('no code takes a calendar day from toISOString()', function(){
  var src = globalThis.__APP_HTML, hits = src.match(/toISOString\(\)\.slice\(0,\s*10\)/g) || [];
  assertEqual(hits.length, 0, 'use todayStr() / dayStr(d): ' + hits.length + ' left');
});
