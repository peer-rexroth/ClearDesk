// Dialog focus contract (audit V-01): where Tab lands inside a dialog and which control a new dialog starts on. The observer and the real
// focus moves need a browser; these are the pure decisions they rely on.
test('modalTrapTarget wraps Tab at the last control and Shift+Tab at the first', function(){
  const a = {}, b = {}, c = {}, items = [a, b, c], root = {};
  assertEqual(modalTrapTarget(items, c, false, root), a, 'Tab on the last goes to the first');
  assertEqual(modalTrapTarget(items, a, true, root), c, 'Shift+Tab on the first goes to the last');
  assertEqual(modalTrapTarget(items, b, false, root), null, 'in the middle the browser moves on');
  assertEqual(modalTrapTarget(items, b, true, root), null, 'in the middle the browser moves on (Shift)');
});
test('modalTrapTarget pulls focus that is outside the dialog back in', function(){
  const a = {}, b = {}, outside = {};
  assertEqual(modalTrapTarget([a, b], outside, false, {}), a, 'Tab from outside lands on the first control');
  assertEqual(modalTrapTarget([a, b], outside, true, {}), b, 'Shift+Tab from outside lands on the last control');
});
test('modalTrapTarget keeps focus on the dialog itself when it has no controls', function(){
  const root = {};
  assertEqual(modalTrapTarget([], {}, false, root), root, 'About has nothing to press: Tab stays on the dialog');
});
test('modalInitialFocus prefers a text field, then the primary button, then the first control', function(){
  const mk = (tag, o)=>Object.assign({ tagName: tag, type: '', classList: { contains: c=>(o && o.cls)===c } }, o || {});
  const btn = mk('BUTTON'), primary = mk('BUTTON', { cls: 'btn-primary' }), field = mk('INPUT', { type: 'text' }), box = mk('INPUT', { type: 'checkbox' });
  assertEqual(modalInitialFocus([btn, primary, field]), field, 'a text field wins');
  assertEqual(modalInitialFocus([btn, box, primary]), primary, 'a checkbox is not a text field; the primary button is next');
  assertEqual(modalInitialFocus([btn, mk('BUTTON')]), btn, 'otherwise the first control');
  assertEqual(modalInitialFocus([]), null, 'nothing to focus');
});
