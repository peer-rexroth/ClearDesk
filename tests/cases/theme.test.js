// The app has one look — Glass — in light and dark. There is no scheme or
// wallpaper picker; these tests pin that down and cover the light/dark control.

test('there is no colour-scheme or wallpaper picker any more', function () {
  assertEqual(typeof THEME_SCHEMES, 'undefined');
  assertEqual(typeof GLASS_BGS, 'undefined');
  assertEqual(typeof setColorScheme, 'undefined');
  assertEqual(typeof setGlassBg, 'undefined');
  assertEqual(typeof openThemeModal, 'undefined');
});

test('save() no longer writes a colorScheme into the data blob', function () {
  save();
  const saved = JSON.parse(localStorage.getItem('mytasks_data_v1'));
  assertEqual(saved.colorScheme, undefined);
  assertEqual(saved.theme, currentTheme, 'light/dark is still saved');
});

test('load() ignores a colorScheme left in an older saved file', function () {
  localStorage.setItem('mytasks_data_v1', JSON.stringify({
    projects: defaultProjects(), tasks: defaultTasks(), colorScheme: 'dracula', theme: 'dark'
  }));
  load();
  assertEqual(currentTheme, 'dark');
  assertEqual(document.documentElement.getAttribute('data-theme'), 'dark');
});

test('setThemeMode switches light and dark, persists it, and does nothing if already there', function () {
  setThemeMode('dark');
  assertEqual(currentTheme, 'dark');
  assertEqual(document.documentElement.getAttribute('data-theme'), 'dark');
  assertEqual(localStorage.getItem('mytasks_theme'), 'dark');
  setThemeMode('dark');
  assertEqual(currentTheme, 'dark');
  setThemeMode('light');
  assertEqual(currentTheme, 'light');
  assertEqual(localStorage.getItem('mytasks_theme'), 'light');
});

test('the Appearance menu offers Light and Dark with thin SF-style SVG icons, not Font Awesome ones', function () {
  renderUiScaleMenu();
  const html = document.getElementById('uiScaleMenu').innerHTML;
  assertIncludes(html, 'Light'); assertIncludes(html, 'Dark');
  assertEqual((html.match(/class="theme-ico"/g) || []).length, 2, 'one inline SVG icon per option');
  assertFalse(html.includes('fa-sun') || html.includes('fa-moon'), 'the heavy solid glyphs stay out');
  assertFalse(html.includes('Color scheme'), 'the scheme button is gone');
  assertFalse(html.includes('Density'), 'the density control is gone');
});
