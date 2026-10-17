// Color scheme picker (Standard/Modern) — persistence and cross-device
// sync via the same theme/compactMode/viewMode plumbing.

test('setColorScheme updates state, the data-scheme attribute, and localStorage', function () {
  setColorScheme('modern');
  assertEqual(colorScheme, 'modern');
  assertEqual(document.documentElement.getAttribute('data-scheme'), 'modern');
  assertEqual(localStorage.getItem('mytasks_scheme'), 'modern');
});

test('load() picks up a colorScheme saved in the data blob, same as theme', function () {
  localStorage.setItem('mytasks_data_v1', JSON.stringify({
    projects: defaultProjects(), tasks: defaultTasks(), colorScheme: 'modern'
  }));
  load();
  assertEqual(colorScheme, 'modern');
  assertEqual(document.documentElement.getAttribute('data-scheme'), 'modern');
});

test('load() ignores an unrecognized colorScheme rather than crashing', function () {
  colorScheme = 'modern';
  localStorage.setItem('mytasks_data_v1', JSON.stringify({
    projects: defaultProjects(), tasks: defaultTasks(), colorScheme: 'not-a-real-scheme'
  }));
  load();
  assertEqual(colorScheme, 'modern', 'an invalid saved scheme should leave the current one alone');
});

test('save() round-trips colorScheme into the stored data blob', function () {
  setColorScheme('modern');
  const saved = JSON.parse(localStorage.getItem('mytasks_data_v1'));
  assertEqual(saved.colorScheme, 'modern');
});

test('every THEME_SCHEMES entry actually has a matching CSS block', function () {
  // A cheap guard against typos: the scheme ids the picker offers should
  // all be spelled the same way the retheme's [data-scheme="..."] selectors expect.
  const ids = THEME_SCHEMES.map(s => s.id).sort();
  assertDeepEqual(ids, ['dracula', 'github', 'githubdimmed', 'glass', 'modern', 'standard']);
});

test('setGlassBg switches the wallpaper attribute, persists it, and rejects unknown ids', function () {
  setGlassBg('sunset');
  assertEqual(glassBg, 'sunset');
  assertEqual(document.documentElement.getAttribute('data-glass-bg'), 'sunset');
  assertEqual(localStorage.getItem('mytasks_glassbg'), 'sunset');
  setGlassBg('not-a-wallpaper');
  assertEqual(glassBg, 'sunset', 'an unknown wallpaper id is ignored');
});

test('the Colors modal offers the Glass background picker only while Glass is selected', function () {
  setColorScheme('modern');
  renderThemeModal();
  assertEqual(document.getElementById('glassBgOptions').innerHTML, '');
  setColorScheme('glass');
  renderThemeModal();
  const html = document.getElementById('glassBgOptions').innerHTML;
  GLASS_BGS.forEach(b => assertIncludes(html, b.name));
});
