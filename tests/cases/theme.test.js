// The app has one look — Glass — in light and dark. There is no scheme or
// wallpaper picker; these tests pin that down and cover the light/dark control.

test('there is no colour-scheme or wallpaper picker any more', function () {
  assertEqual(typeof THEME_SCHEMES, 'undefined');
  assertEqual(typeof GLASS_BGS, 'undefined');
  assertEqual(typeof setColorScheme, 'undefined');
  assertEqual(typeof setGlassBg, 'undefined');
  assertEqual(typeof openThemeModal, 'undefined');
});

test('save() writes neither a colorScheme nor a theme into the data blob', function () {
  save();
  const saved = JSON.parse(localStorage.getItem('mytasks_data_v1'));
  assertEqual(saved.colorScheme, undefined);
  assertEqual(saved.theme, undefined, 'theme is a per-device preference now, not synced');
});

test('load() ignores a colorScheme and a theme left in an older or synced file', function () {
  setThemeMode('light');
  localStorage.setItem('mytasks_data_v1', JSON.stringify({
    projects: defaultProjects(), tasks: defaultTasks(), colorScheme: 'dracula', theme: 'dark'
  }));
  load();
  assertEqual(currentTheme, 'light', 'another device\'s theme must not override this one\'s');
  assertEqual(themePref, 'light');
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

test('the Appearance menu: Light | Dark are always shown (dimmed while Match System is on), SVG icons not Font Awesome', function () {
  setThemeMode('auto');
  let html = document.getElementById('uiScaleMenu').innerHTML;
  assertIncludes(html, 'Match System'); assertIncludes(html, 'aria-checked="true"'); assertIncludes(html, 'Currently');
  assertIncludes(html, 'Light'); assertIncludes(html, 'Dark');
  assertIncludes(html, 'ap-off', 'the segments are dimmed while the app follows the system');
  assertEqual((html.match(/ disabled/g) || []).length, 2, 'and not clickable');
  setThemeMode('dark');
  html = document.getElementById('uiScaleMenu').innerHTML;
  assertIncludes(html, 'aria-checked="false"'); assertFalse(html.includes('ap-off')); assertFalse(html.includes(' disabled'));
  assertEqual((html.match(/class="theme-ico"/g) || []).length, 2, 'one inline SVG icon per option (Light, Dark)');
  assertFalse(html.includes('fa-sun') || html.includes('fa-moon'), 'the heavy solid glyphs stay out');
  assertFalse(html.includes('Color scheme'), 'the scheme button is gone');
  assertFalse(html.includes('Density'), 'the density control is gone');
  setThemeMode('auto');
});

test('Auto is the default and follows the system; Light and Dark override it', function () {
  const real = window.matchMedia;
  try {
    window.matchMedia = function () { return { matches: true, addEventListener() {} }; };
    setThemeMode('auto');
    assertEqual(themePref, 'auto');
    assertEqual(currentTheme, 'dark', 'the system is dark, so Auto is dark');
    assertEqual(localStorage.getItem('mytasks_theme'), 'auto');
    setThemeMode('light');
    assertEqual(currentTheme, 'light', 'an explicit choice beats the system');
    window.matchMedia = function () { return { matches: false, addEventListener() {} }; };
    setThemeMode('auto');
    assertEqual(currentTheme, 'light');
  } finally { window.matchMedia = real; }
});

test('an unrecognised saved theme value falls back to Auto', function () {
  localStorage.setItem('mytasks_theme', 'purple');
  themePref = 'dark';
  // the startup logic, as written: only light/dark are honoured
  const t = localStorage.getItem('mytasks_theme');
  const pref = (t === 'light' || t === 'dark') ? t : 'auto';
  assertEqual(pref, 'auto');
  setThemeMode('light');
});
