// A block of table cells (drag / Shift+click): the rectangle is the same whichever corner it was dragged from, and one cell is not a block.
test('tblBlockRect: the same rectangle from any corner', function () {
  var want = { r1: 1, r2: 3, c1: 1, c2: 2 };
  assertEqual(JSON.stringify(tblBlockRect({ a: { r: 1, c: 1 }, b: { r: 3, c: 2 } })), JSON.stringify(want));
  assertEqual(JSON.stringify(tblBlockRect({ a: { r: 3, c: 2 }, b: { r: 1, c: 1 } })), JSON.stringify(want), 'dragged up and to the left');
  assertEqual(JSON.stringify(tblBlockRect({ a: { r: 3, c: 1 }, b: { r: 1, c: 2 } })), JSON.stringify(want), 'dragged up and to the right');
});
test('tblBlockMany: one cell is not a block', function () {
  assertEqual(tblBlockMany({ a: { r: 2, c: 2 }, b: { r: 2, c: 2 } }), false);
  assertEqual(tblBlockMany({ a: { r: 2, c: 2 }, b: { r: 2, c: 3 } }), true);
  assertEqual(tblBlockMany({ a: { r: 2, c: 2 }, b: { r: 3, c: 2 } }), true);
});

test('tblSortNumber reads numbers as people write them', function () {
  assertEqual(tblSortNumber('12'), 12); assertEqual(tblSortNumber('-3.5'), -3.5); assertEqual(tblSortNumber('1,234.50'), 1234.5); assertEqual(tblSortNumber('1.234,50'), 1234.5);
  assertEqual(tblSortNumber('1,5'), 1.5); assertEqual(tblSortNumber('1,234'), 1234); assertEqual(tblSortNumber('€ 10'), 10); assertEqual(tblSortNumber('12 %'), 12); assertEqual(tblSortNumber('(5)'), -5);
  assertEqual(tblSortNumber('abc'), null); assertEqual(tblSortNumber('12a'), null); assertEqual(tblSortNumber(''), null); assertEqual(tblSortNumber('1.2.3'), null);
});

test('tblSortOrder: numbers as numbers, text without case, empty cells last, ties keep their order', function () {
  assertEqual(JSON.stringify(tblSortOrder(['10', '2', '', '30'], 'asc')), '[1,0,3,2]', 'ascending numbers, the empty one last');
  assertEqual(JSON.stringify(tblSortOrder(['10', '2', '', '30'], 'desc')), '[3,0,1,2]', 'descending, the empty one still last');
  assertEqual(JSON.stringify(tblSortOrder(['b', 'A', 'c'], 'asc')), '[1,0,2]', 'case ignored');
  assertEqual(JSON.stringify(tblSortOrder(['item 10', 'item 9', 'item 1'], 'asc')), '[2,1,0]', 'numbers inside text are in order');
  assertEqual(JSON.stringify(tblSortOrder(['x', 'x', 'a'], 'asc')), '[2,0,1]', 'equal cells keep their order');
  assertEqual(JSON.stringify(tblSortOrder(['3', 'b', '1'], 'asc')), '[2,0,1]', 'a mix sorts as text');
});
