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

test('tblEqualWidths: the chosen columns share what they have between them, the others stay', function () {
  var r = tblEqualWidths([30, 10, 10, 20, 10, 20], 1, 4);
  assertEqual(r.map(function(x){ return Math.round(x * 100) / 100; }).join(' '), '30 12.5 12.5 12.5 12.5 20');
  assertEqual(r.reduce(function(a, b){ return a + b; }, 0), 100);
});

test('tblFitWidths: fitted columns take what their text needs, the others give or take in proportion, never below the minimum', function () {
  var w = [25, 25, 25, 25], out = tblFitWidths(w, 1, 1, [40]);
  assertEqual(Math.round(out[1]), 40); assertEqual(Math.round(out[0]), 20); assertEqual(Math.round(out[0]), Math.round(out[2]));
  assertEqual(Math.round(out.reduce(function(a, b){ return a + b; }, 0)), 100);
  var tight = tblFitWidths([25, 25, 25, 25], 0, 0, [500]);
  assertEqual(tight[1] >= TBL_MIN_COL - 0.001, true, 'the others keep the minimum');
  assertEqual(Math.round(tight.reduce(function(a, b){ return a + b; }, 0)), 100);
  var all = tblFitWidths([50, 50], 0, 1, [10, 30]);
  assertEqual(Math.round(all[0]) + ',' + Math.round(all[1]), '25,75', 'all columns: in proportion to what they need');
});

test('the table edge add bars (Claude style): hot strips along the last column and row run tblPlus; the old round plus buttons are gone', function () {
  var src = tblHandlesShow.toString();
  assertIncludes(src, 'tbl-add col'); assertIncludes(src, 'tbl-add row'); assertIncludes(src, "tblPlus(event,'colAfter'"); assertIncludes(src, "tblPlus(event,'rowAfter'"); assertNotIncludes(src, 'tbl-plus');
});
