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
