// Text size segmented control (Appearance menu) — a 2-stop CSS zoom on <html>
// (M/L, full names Medium/Large in each segment's own tooltip), picked from a
// .view-switch pill (the same segmented control the List/Board toggle uses),
// persisted/synced the same way the theme is. Small and Extra Large were removed.

test('UI_SCALE_STEPS offers exactly Medium and Large, in order, as a small and a large A', function () {
  assertDeepEqual(UI_SCALE_STEPS.map(s => s.label), ['Medium', 'Large']);
  assertDeepEqual(UI_SCALE_STEPS.map(s => s.pct), [100, 115]);
  assertTrue(UI_SCALE_STEPS[0].glyph < UI_SCALE_STEPS[1].glyph, 'the Large letter is drawn bigger than the Medium one');
});

test('uiScaleStepIndex finds the exact stop, and snaps an in-between value to the nearest one', function () {
  assertEqual(uiScaleStepIndex(100), 0);
  assertEqual(uiScaleStepIndex(115), 1);
  assertEqual(uiScaleStepIndex(103), 0, 'closer to Medium (100) than Large (115)');
  assertEqual(uiScaleStepIndex(90), 0, 'a saved Small snaps to Medium');
  assertEqual(uiScaleStepIndex(130), 1, 'a saved Extra Large snaps to Large');
  assertEqual(uiScaleStepIndex(999), 1, 'clamps to the last stop for anything past it');
});

test('clampUiScale snaps any value to one of the 2 real stops', function () {
  assertEqual(clampUiScale(103), 100);
  assertEqual(clampUiScale(90), 100);
  assertEqual(clampUiScale(130), 115);
  assertEqual(clampUiScale(999), 115);
  assertEqual(clampUiScale('not-a-number'), UI_SCALE_DEFAULT, 'falls back to the default on garbage input');
});

test('a fresh session with nothing saved defaults to Medium', function () {
  assertEqual(uiScale, UI_SCALE_DEFAULT);
  assertEqual(UI_SCALE_STEPS[uiScaleStepIndex(uiScale)].label, 'Medium');
});

test('setUiScale updates state, applies the zoom style, and localStorage', function () {
  setUiScale(115);
  assertEqual(uiScale, 115);
  assertEqual(document.documentElement.style.zoom, 1.15);
  assertEqual(localStorage.getItem('mytasks_uiscale'), '115');
});

test('setUiScale snaps an off-stop value to the nearest real one before storing it', function () {
  setUiScale(999);
  assertEqual(uiScale, 115);
  setUiScale(103);
  assertEqual(uiScale, 100);
});

test('setUiScale closes the popover after picking a segment', function () {
  document.getElementById('uiScaleMenu').classList.add('open');
  setUiScale(115);
  assertFalse(document.getElementById('uiScaleMenu').classList.contains('open'));
});

test('load() picks up a uiScale saved in the data blob, same as the theme', function () {
  localStorage.setItem('mytasks_data_v1', JSON.stringify({
    projects: defaultProjects(), tasks: defaultTasks(), uiScale: 115
  }));
  load();
  assertEqual(uiScale, 115);
  assertEqual(document.documentElement.style.zoom, 1.15);
});

test('load() moves a removed size (Small / Extra Large) onto the nearest offered one', function () {
  localStorage.setItem('mytasks_data_v1', JSON.stringify({ projects: defaultProjects(), tasks: defaultTasks(), uiScale: 90 }));
  load();
  assertEqual(uiScale, 100, 'Small -> Medium');
  localStorage.setItem('mytasks_data_v1', JSON.stringify({ projects: defaultProjects(), tasks: defaultTasks(), uiScale: 130 }));
  load();
  assertEqual(uiScale, 115, 'Extra Large -> Large');
});

test('load() ignores a non-numeric uiScale rather than crashing', function () {
  uiScale = 115;
  localStorage.setItem('mytasks_data_v1', JSON.stringify({
    projects: defaultProjects(), tasks: defaultTasks(), uiScale: 'huge'
  }));
  load();
  assertEqual(uiScale, 115, 'an invalid saved scale should leave the current one alone');
});

test('save() round-trips uiScale into the stored data blob', function () {
  setUiScale(115);
  const saved = JSON.parse(localStorage.getItem('mytasks_data_v1'));
  assertEqual(saved.uiScale, 115);
});

// Pulls {short, title, active} out of each rendered segment button, in
// order — avoids brittle substring matching against exact attribute
// ordering.
function renderedUiScaleSegments(){
  const html = document.getElementById('uiScaleMenu').innerHTML;
  const re = /class="view-switch-btn( active)?" title="([^"]+)"[^>]*>([^<]+)</g;
  const out = [];
  let m;
  while((m = re.exec(html))) out.push({ active: !!m[1], title: m[2], short: m[3] });
  return out;
}

test('renderUiScaleMenu builds a 2-segment pill of a small and a large A, with the current stop marked active', function () {
  setUiScale(115);
  renderUiScaleMenu();
  const segments = renderedUiScaleSegments();
  assertDeepEqual(segments.map(s => s.short), ['A', 'A'], 'both segments show the letter A, at different sizes');
  assertDeepEqual(segments.map(s => s.title), ['Medium', 'Large'], 'the full name is each segment\'s own tooltip');
  assertEqual(segments.filter(s => s.active).length, 1, 'exactly one segment is marked active');
  assertEqual(segments.find(s => s.active).title, 'Large', 'Large (115%) is the active segment');
});

test('renderUiScaleMenu moves the active segment when the scale changes', function () {
  setUiScale(100);
  renderUiScaleMenu();
  assertEqual(renderedUiScaleSegments().find(s => s.active).title, 'Medium');
  setUiScale(115);
  renderUiScaleMenu();
  assertEqual(renderedUiScaleSegments().find(s => s.active).title, 'Large');
});
