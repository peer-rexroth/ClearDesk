// Audit U-16: every icon-only button must have an accessible name.
function a11yFakeBtn(attrs, text){
  const a = Object.assign({}, attrs);
  return { textContent: text || '', getAttribute: k => (k in a ? a[k] : null), setAttribute: (k, v) => { a[k] = String(v); }, _a: a };
}

test('no icon-only button in the markup or the templates lacks a title or aria-label', function(){
  const bad = [];
  const re = /<(button|div|span)\b([^>]*)>([\s\S]*?)<\/\1>/g;
  let m;
  while((m = re.exec(__APP_HTML))){
    const attrs = m[2], inner = m[3];
    if(m[1] !== 'button' && attrs.indexOf('role="button"') < 0) continue;
    if(inner.length > 600) continue;
    const text = inner.replace(/<[^>]*>/g, '').replace(/\$\{[^}]*\}/g, '').trim();
    if(text) continue;
    if(/\btitle=/.test(attrs) || attrs.indexOf('aria-label') >= 0) continue;
    // a chip or menu row whose text comes from a template call is not icon-only
    if(/\$\{\s*(esc|popOptInner)\(/.test(inner)) continue;
    bad.push(m[0].slice(0, 90));
  }
  assertEqual(bad.length, 0, 'icon-only without a name: ' + bad.join(' | '));
});

test('iconButtonLabel copies a title into the accessible name and leaves other buttons alone', function(){
  assertEqual(iconButtonLabel(a11yFakeBtn({ title: 'Delete' })), 'Delete');
  assertEqual(iconButtonLabel(a11yFakeBtn({ title: 'Delete', 'aria-label': 'Remove' })), null, 'own label wins');
  assertEqual(iconButtonLabel(a11yFakeBtn({ title: 'Filter' }, ' Filter ')), null, 'visible text names it');
  assertEqual(iconButtonLabel(a11yFakeBtn({})), null, 'nothing to copy');
  const b = a11yFakeBtn({ title: 'Collapse subtasks' });
  const root = { querySelectorAll: () => [b] };
  labelIconButtons(root);
  assertEqual(b._a['aria-label'], 'Collapse subtasks');
  b._a.title = 'Expand subtasks';
  labelIconButtons(root);
  assertEqual(b._a['aria-label'], 'Expand subtasks', 'a label written by the pass follows the title');
});
