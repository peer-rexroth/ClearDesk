// Audit V-02: the sidebar floats below one window width, and the CSS and the JS must agree on it (the bars' one-row promise depends on it).
// The wrapping itself needs a real layout: it was measured in Chrome at 1400 / 1000 / 860 / 800 / 740 / 680 px in every view.
test('the sidebar float width is the same in the CSS media queries and in the script', function(){
  assertEqual(SIDEBAR_FLOAT_W, 1100);
  assertTrue(__APP_HTML.indexOf('@media (max-width: ' + SIDEBAR_FLOAT_W + 'px) {\n    /* narrow') >= 0, 'the floating-sidebar query uses it');
  assertTrue(__APP_HTML.indexOf('@media (min-width: ' + (SIDEBAR_FLOAT_W + 1) + 'px) { .sidebar { position: relative') >= 0, 'the docked-sidebar query is one pixel above it');
});
test('the tasks bar, the notes bar and the prompts bar have a container step for a narrow pane', function(){
  ['@container mainpane (max-width: 880px)', '@container notepane (max-width: 500px)', '@container notepane (max-width: 520px) { #pFavBtn'].forEach(function(k){
    assertTrue(__APP_HTML.indexOf(k) >= 0, 'missing: ' + k);
  });
});
