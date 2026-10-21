// Prompts mode: the template language (detect + build), data integrity, merge, lists, and the delete / restore / folder flows.

function pmk(over) {
  const now = Date.now();
  return Object.assign({ id: genId(), name: 'P', folderId: '', favorite: false, locked: false, template: '', vars: {}, presets: [], createdAt: now, updatedAt: now }, over || {});
}
function pfresh() { prompts = []; promptFolders = []; deletedPromptIds = []; deletedPromptFolderIds = []; promptFolderFilter = 'all'; promptSearchQuery = ''; selectedPromptId = null; promptEditorId = null; }

test('detectPromptVars finds the three kinds, keeps existing settings and skips escaped placeholders', function () {
  const v = detectPromptVars('A {{depth}} B [[parts]] C ((topic)) D \\{{literal}} {{depth}}', { depth: { type: 'option', options: ['2', '3'], selected: '3' } });
  assertDeepEqual(Object.keys(v), ['depth', 'parts', 'topic']);
  assertEqual(v.depth.selected, '3', 'an existing option variable keeps its options and choice');
  assertEqual(v.parts.type, 'instruction'); assertEqual(v.topic.type, 'text');
  assertDeepEqual(detectPromptVars('plain'), {});
  assertEqual(detectPromptVars('{{a}}', { a: { type: 'text', value: 'x' } }).a.type, 'option', 'a variable whose kind changed starts fresh');
});

test('buildPromptFinal fills choices, checklists (as bullet lines, in option order) and text, and keeps escaped placeholders as plain text', function () {
  const p = pmk({ template: 'Depth {{d}}\n[[items]]\nTopic: ((t)) \\{{literal}}', vars: {
    d: { type: 'option', options: ['2', '3'], selected: '3' },
    items: { type: 'instruction', options: ['One', 'Two', 'Three'], selected: ['Three', 'One'] },
    t: { type: 'text', value: 'churn' } } });
  assertEqual(buildPromptFinal(p), 'Depth 3\n• One\n• Three\nTopic: churn {{literal}}');
  p.vars.d.selected = ''; p.vars.items.selected = [];
  assertEqual(buildPromptFinal(p), 'Depth \n\nTopic: churn {{literal}}', 'nothing chosen leaves the spot empty');
});

test('promptHighlight tints placeholders, escapes the text and leaves escaped placeholders plain', function () {
  const h = promptHighlight('<b> {{a}} [[b]] ((c)) \\{{d}}');
  assertIncludes(h, '&lt;b&gt;');
  assertIncludes(h, '<span class="ph ph-opt">{{a}}</span>'); assertIncludes(h, '<span class="ph ph-ins">[[b]]</span>'); assertIncludes(h, '<span class="ph ph-txt">((c))</span>');
  assertIncludes(h, '\\{{d}}'); assertFalse(h.includes('ph-opt">{{d}}'));
});

test('normalizePrompts repairs the data: ids, fields, folders, variables, one-level folders', function () {
  prompts = [{ id: 'a b', name: 5, template: 'x {{v}}', folderId: 'gone', vars: { v: { type: 'option', options: ['A', 'B'], selected: 'A' }, stale: { type: 'text', value: 'x' } }, presets: [{ name: 'ok', values: {} }, { bad: 1 }]}, null];
  promptFolders = [{ id: 'f1', name: 'Top' }, { id: 'f2', name: 'Sub', parentId: 'f1' }, { id: 'f3', name: 'Deep', parentId: 'f2' }, { id: 'f4', name: 'Self', parentId: 'f4' }];
  normalizePrompts();
  assertEqual(prompts.length, 1);
  const p = prompts[0];
  assertTrue(isSafeId(p.id)); assertEqual(p.name, '5'); assertEqual(p.folderId, '');
  assertDeepEqual(Object.keys(p.vars), ['v'], 'variables follow the template');
  assertEqual(p.presets.length, 1);
  assertEqual(promptFolders.find(f => f.id === 'f2').parentId, 'f1');
  assertFalse('parentId' in promptFolders.find(f => f.id === 'f3'), 'no subfolder of a subfolder');
  assertFalse('parentId' in promptFolders.find(f => f.id === 'f4'), 'no folder inside itself');
});

test('normalizePrompts removes a prompt that has been in Recently Deleted for over 30 days and tombstones it', function () {
  pfresh();
  prompts = [pmk({ id: 'old', deletedAt: Date.now() - 31 * 86400000 }), pmk({ id: 'new', deletedAt: Date.now() - 86400000 })];
  normalizePrompts();
  assertDeepEqual(prompts.map(p => p.id), ['new']);
  assertTrue(deletedPromptIds.some(t => t.id === 'old'));
});

test('mergePromptsData: the newer edit wins, tombstones keep a deleted prompt deleted, a newer incoming copy brings it back', function () {
  pfresh();
  prompts = [pmk({ id: 'p1', name: 'Mine', updatedAt: 100 })];
  let r = mergePromptsData({ prompts: [{ id: 'p1', name: 'Theirs', template: '', updatedAt: 200 }, { id: 'p2', name: 'New', template: '', updatedAt: 50 }] }, true);
  assertEqual(prompts.find(p => p.id === 'p1').name, 'Theirs'); assertEqual(r.updated, 1); assertEqual(r.added, 1);
  r = mergePromptsData({ prompts: [{ id: 'p1', name: 'Older', updatedAt: 10 }] }, true);
  assertEqual(prompts.find(p => p.id === 'p1').name, 'Theirs', 'an older copy does not overwrite');
  deletedPromptIds = [{ id: 'gone', deletedAt: 500 }];
  mergePromptsData({ prompts: [{ id: 'gone', name: 'Stale', template: '', updatedAt: 400 }] }, true);
  assertFalse(prompts.some(p => p.id === 'gone'), 'a stale copy stays deleted');
  mergePromptsData({ prompts: [{ id: 'gone', name: 'Edited later', template: '', updatedAt: 900 }] }, true);
  assertTrue(prompts.some(p => p.id === 'gone'), 'an edit after the deletion wins');
  assertFalse(deletedPromptIds.some(t => t.id === 'gone'));
  mergePromptsData({ deletedPromptIds: [{ id: 'p2', deletedAt: 999 }] }, true);
  assertTrue(deletedPromptIds.some(t => t.id === 'p2'), 'incoming tombstones are merged in');
});

test('visiblePrompts: folders include their subfolders, Favorites, Recently Deleted and a search through every folder, sorted by name', function () {
  pfresh();
  setPromptSort('title');
  promptFolders = [{ id: 'f1', name: 'Top', updatedAt: 1 }, { id: 'f2', name: 'Sub', parentId: 'f1', updatedAt: 1 }];
  prompts = [pmk({ id: 'a', name: 'Zed', folderId: 'f2', favorite: true }), pmk({ id: 'b', name: 'Alpha', folderId: 'f1', template: 'finds the needle' }), pmk({ id: 'c', name: 'Loose' }), pmk({ id: 'd', name: 'Gone', deletedAt: 5 })];
  assertDeepEqual(visiblePrompts().map(p => p.id), ['b', 'c', 'a'], 'All Prompts: alphabetical, without the deleted one');
  promptFolderFilter = 'f1'; assertDeepEqual(visiblePrompts().map(p => p.id), ['b', 'a'], 'a folder shows its subfolders too');
  promptFolderFilter = 'f2'; assertDeepEqual(visiblePrompts().map(p => p.id), ['a']);
  promptFolderFilter = 'favorites'; assertDeepEqual(visiblePrompts().map(p => p.id), ['a']);
  promptFolderFilter = 'trash'; assertDeepEqual(visiblePrompts().map(p => p.id), ['d']);
  promptFolderFilter = 'f2'; promptSearchQuery = 'needle'; assertDeepEqual(visiblePrompts().map(p => p.id), ['b'], 'a search looks in every folder, in names and templates');
});

test('delete moves a prompt to Recently Deleted, restore brings it back, a locked prompt cannot be deleted, deleting there is permanent', function () {
  pfresh();
  const p = pmk({ id: 'x', name: 'Doomed' }); prompts = [p]; selectedPromptId = 'x';
  deletePrompt('x');
  assertTrue(promptTrashed(p)); assertEqual(selectedPromptId, null);
  restorePrompt('x');
  assertFalse(promptTrashed(p)); assertEqual(selectedPromptId, 'x');
  p.locked = true; deletePrompt('x'); assertFalse(promptTrashed(p), 'locked prompts are not deleted');
  p.locked = false; deletePrompt('x'); permanentDeletePrompt('x');
  assertEqual(prompts.length, 0); assertTrue(deletedPromptIds.some(t => t.id === 'x'));
});

test('favorite, lock, clone and move', function () {
  pfresh();
  promptFolders = [{ id: 'f1', name: 'Top', updatedAt: 1 }];
  const p = pmk({ id: 'x', name: 'Base', template: 'A {{v}}', vars: { v: { type: 'option', options: ['1'], selected: '1' } }, locked: true });
  prompts = [p]; promptEditorId = 'x';
  togglePromptFavorite('x'); assertTrue(p.favorite);
  togglePromptLock('x'); assertFalse(p.locked);
  clonePrompt('x');
  assertEqual(prompts.length, 2);
  const c = prompts.find(q => q.id !== 'x');
  assertEqual(c.name, 'Base copy'); assertFalse(c.favorite); assertFalse(c.locked); assertEqual(c.vars.v.selected, '1');
  movePrompt('x', 'f1'); assertEqual(p.folderId, 'f1');
  p.locked = true; movePrompt('x', ''); assertEqual(p.folderId, 'f1', 'a locked prompt does not move');
});

test('variables: picking, checklist toggling, adding and removing options, presets (text variables are not part of a preset)', function () {
  pfresh();
  const p = pmk({ id: 'x', template: '{{d}} [[l]] ((t))', vars: { d: { type: 'option', options: ['A', 'B'], selected: 'A' }, l: { type: 'instruction', options: ['X', 'Y'], selected: [] }, t: { type: 'text', value: 'typed' } } });
  prompts = [p]; promptEditorId = 'x';
  const host = { closest: () => ({ dataset: { v: 'd' } }) };
  pickPromptOption(host, 1); assertEqual(p.vars.d.selected, 'B');
  pickPromptOption(host, 1); assertEqual(p.vars.d.selected, '', 'picking the chosen one again clears it');
  const lhost = { closest: () => ({ dataset: { v: 'l' } }) };
  togglePromptItem(lhost, 0); togglePromptItem(lhost, 1); assertDeepEqual(p.vars.l.selected, ['X', 'Y']);
  p.presets = [{ name: 'Both', values: { d: 'B', l: ['X', 'Y'] } }];
  pickPromptOption(host, 1);
  assertTrue(promptPresetMatches(p, p.presets[0]));
  p.vars.t.value = 'something else';
  assertTrue(promptPresetMatches(p, p.presets[0]), 'text variables are not compared');
  applyPromptPreset(-1);
  assertEqual(p.vars.d.selected, ''); assertDeepEqual(p.vars.l.selected, []); assertEqual(p.vars.t.value, '', 'Clear resets everything');
  p.vars.t.value = 'keep me'; applyPromptPreset(0);
  assertEqual(p.vars.d.selected, 'B'); assertEqual(p.vars.t.value, 'keep me', 'a named preset leaves text variables alone');
  removePromptOption(host, 1);
  assertDeepEqual(p.vars.d.options, ['A']); assertEqual(p.vars.d.selected, '', 'removing the chosen option clears the choice');
  assertEqual(p.presets[0].values.d, '', 'and a preset forgets it');
  p.locked = true; removePromptOption(host, 0); assertDeepEqual(p.vars.d.options, ['A'], 'a locked prompt keeps its options');
});

test('folders: creating through the dialog, deleting moves prompts out, and the dialog edits the right set', function () {
  pfresh();
  const input = document.getElementById('folderNameInput'); input.value = 'Ideas';
  openPromptFolderModal(); assertEqual(folderModalKind, 'prompts');
  input.value = 'Ideas'; savePromptFolderModal();
  assertEqual(promptFolders.length, 1); assertEqual(promptFolders[0].name, 'Ideas'); assertEqual(promptFolderFilter, promptFolders[0].id);
  const fid = promptFolders[0].id;
  prompts = [pmk({ id: 'a', folderId: fid })];
  deletePromptFolder(fid);                                         
  assertEqual(promptFolders.length, 0); assertEqual(prompts[0].folderId, '');
  assertTrue(deletedPromptFolderIds.some(t => t.id === fid)); assertEqual(promptFolderFilter, 'all');
});

test('the data round trip: prompts are in the saved payload and survive a load', function () {
  pfresh();
  prompts = [pmk({ id: 'rt', name: 'Round trip', template: 'Hi {{x}}' })]; promptFolders = [{ id: 'rf', name: 'F', updatedAt: 1 }];
  const d = dataPayload();
  assertEqual(d.prompts.length, 1); assertEqual(d.promptFolders[0].name, 'F'); assertTrue('deletedPromptIds' in d);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  pfresh(); load();
  assertEqual(prompts.length, 1); assertEqual(prompts[0].name, 'Round trip'); assertEqual(Object.keys(prompts[0].vars)[0], 'x');
});

test('removePromptOptionAt removes an option or item, clears it from the choice and from presets, and does nothing on a locked prompt', function () {
  pfresh();
  const p = pmk({ id: 'x', template: '{{s}} [[e]]', vars: { s: { type: 'option', options: ['S', 'M', 'L'], selected: 'L' }, e: { type: 'instruction', options: ['A', 'B'], selected: ['A', 'B'] } }, presets: [{ name: 'P', values: { s: 'L', e: ['A', 'B'] } }] });
  prompts = [p]; promptEditorId = 'x';
  removePromptOptionAt(p, 's', 2);
  assertDeepEqual(p.vars.s.options, ['S', 'M']); assertEqual(p.vars.s.selected, ''); assertEqual(p.presets[0].values.s, '');
  removePromptOptionAt(p, 'e', 0);
  assertDeepEqual(p.vars.e.options, ['B']); assertDeepEqual(p.vars.e.selected, ['B']); assertDeepEqual(p.presets[0].values.e, ['B']);
  p.locked = true; removePromptOptionAt(p, 's', 0);
  assertDeepEqual(p.vars.s.options, ['S', 'M'], 'a locked prompt keeps its options');
});

test('renaming: an option keeps its place and choice and updates presets; a duplicate is refused; a preset is renamed', function () {
  pfresh();
  const p = pmk({ id: 'x', template: '{{s}} [[e]]', vars: { s: { type: 'option', options: ['S', 'M'], selected: 'M' }, e: { type: 'instruction', options: ['A', 'B'], selected: ['B'] } }, presets: [{ name: 'One', values: { s: 'M', e: ['B'] } }, { name: 'Two', values: {} }] });
  prompts = [p]; promptEditorId = 'x';
  assertEqual(renamePromptOption(p, 's', 1, 'Medium'), null);
  assertDeepEqual(p.vars.s.options, ['S', 'Medium']); assertEqual(p.vars.s.selected, 'Medium'); assertEqual(p.presets[0].values.s, 'Medium');
  assertIncludes(renamePromptOption(p, 's', 0, 'Medium'), 'already'); assertDeepEqual(p.vars.s.options, ['S', 'Medium']);
  renamePromptOption(p, 'e', 1, 'Bee');
  assertDeepEqual(p.vars.e.options, ['A', 'Bee']); assertDeepEqual(p.vars.e.selected, ['Bee']); assertDeepEqual(p.presets[0].values.e, ['Bee']);
  assertEqual(renamePromptPreset(p, 0, 'Uno'), null); assertEqual(p.presets[0].name, 'Uno');
  assertIncludes(renamePromptPreset(p, 0, 'Two'), 'already');
  p.locked = true; renamePromptOption(p, 's', 0, 'Nope'); assertEqual(p.vars.s.options[0], 'S', 'a locked prompt keeps its options');
});

test('renaming a variable rewrites its placeholders in the template (not escaped ones), keeps its settings and presets, and refuses clashes', function () {
  pfresh();
  const p = pmk({ id: 'x', template: 'A {{size}} B {{size}} C [[size]] D \\{{size}} E ((t))', vars: { size: { type: 'option', options: ['S'], selected: 'S' }, t: { type: 'text', value: 'v' } }, presets: [{ name: 'P', values: { size: 'S' } }] });
  prompts = [p]; promptEditorId = 'x';
  assertEqual(renamePromptVar(p, 'size', 'shirt size'), null);
  assertEqual(p.template, 'A {{shirt size}} B {{shirt size}} C [[size]] D \\{{size}} E ((t))', 'only the {{ }} placeholders of that variable, not the escaped one or another kind');
  assertDeepEqual(Object.keys(p.vars), ['shirt size', 't']); assertEqual(p.vars['shirt size'].selected, 'S');
  assertDeepEqual(Object.keys(p.presets[0].values), ['shirt size']);
  assertIncludes(renamePromptVar(p, 't', 'shirt size'), 'already');
  assertIncludes(renamePromptVar(p, 't', '{}'), 'empty');
  assertEqual(renamePromptVar(p, 't', 'a(b)'), null); assertTrue('ab' in p.vars, 'brackets are stripped from a name');
});

test('a double-click (the second click of a pair) puts the choices back as they were, so renaming by double-click never changes them', function () {
  pfresh();
  const p = pmk({ id: 'x', template: '{{s}} [[e]] ((t))', vars: { s: { type: 'option', options: ['S', 'M'], selected: 'M' }, e: { type: 'instruction', options: ['A'], selected: ['A'] }, t: { type: 'text', value: 'keep' } } });
  prompts = [p]; promptEditorId = 'x';
  const host = { closest: () => ({ dataset: { v: 's' } }) };
  pickPromptOption(host, 0, { detail: 1 }); assertEqual(p.vars.s.selected, 'S', 'the first click chooses');
  pickPromptOption(host, 0, { detail: 2 }); assertEqual(p.vars.s.selected, 'M', 'the second click of a double-click restores the choice');
  assertDeepEqual(p.vars.e.selected, ['A']); assertEqual(p.vars.t.value, 'keep');
  pickPromptOption(host, 0, { detail: 2 }); assertEqual(p.vars.s.selected, 'S', 'a lone "second" click with nothing to restore is an ordinary click');
});

// ---- global variables ({{@name}}) ----
function pgfresh() { pfresh(); promptGlobals = []; deletedPromptGlobalIds = []; }

test('detectPromptVars: {{@name}} is a global variable (key @name), not a choice; escaped ones are skipped; settings are kept', function () {
  const v = detectPromptVars('A {{@Lang}} B {{size}} C \\{{@no}} D {{@Lang}}', { '@Lang': { type: 'global', selected: 'DE' } });
  assertDeepEqual(Object.keys(v), ['@Lang', 'size']);
  assertEqual(v['@Lang'].type, 'global'); assertEqual(v['@Lang'].selected, 'DE'); assertEqual(v.size.type, 'option');
});

test('a global variable takes its values from the central list: the final text uses the chosen value while it exists', function () {
  pgfresh();
  promptGlobals = [{ id: 'g1', name: 'Language', options: ['English', 'Deutsch'], updatedAt: 1 }];
  const p = pmk({ template: 'In {{@language}}!', vars: { '@language': { type: 'global', selected: 'Deutsch' } } });   // the name is matched without regard to case
  assertEqual(buildPromptFinal(p), 'In Deutsch!');
  promptGlobals[0].options = ['English'];
  assertEqual(buildPromptFinal(p), 'In !', 'a value that was removed centrally no longer counts');
  promptGlobals = [];
  assertEqual(buildPromptFinal(p), 'In !', 'and a missing variable fills in nothing');
});

test('normalizePromptGlobals repairs names and values and drops duplicates; mergePromptGlobals: newer wins, tombstones respected', function () {
  pgfresh();
  promptGlobals = [{ id: 'a b', name: ' {Lang}@ ', options: ['x', 'x', ' ', 'y'] }, { id: 'g2', name: 'lang', options: [] }, null];
  normalizePromptGlobals();
  assertEqual(promptGlobals.length, 1); assertTrue(isSafeId(promptGlobals[0].id)); assertEqual(promptGlobals[0].name, 'Lang'); assertDeepEqual(promptGlobals[0].options, ['x', 'y']);
  promptGlobals = [{ id: 'g1', name: 'Tone', options: ['A'], updatedAt: 100 }];
  let r = mergePromptGlobals({ promptGlobals: [{ id: 'g1', name: 'Tone', options: ['A', 'B'], updatedAt: 200 }, { id: 'g2', name: 'New', options: [], updatedAt: 5 }] }, true);
  assertDeepEqual(promptGlobals.find(g => g.id === 'g1').options, ['A', 'B']); assertEqual(r.added, 1); assertEqual(r.updated, 1);
  deletedPromptGlobalIds = [{ id: 'gone', deletedAt: 500 }];
  mergePromptGlobals({ promptGlobals: [{ id: 'gone', name: 'Old', options: [], updatedAt: 400 }] }, true);
  assertFalse(promptGlobals.some(g => g.id === 'gone'), 'a stale copy stays deleted');
});

test('renaming a global value or the variable itself follows into every prompt (choice, presets, template); removing a value clears it', function () {
  pgfresh();
  const g = { id: 'g1', name: 'Language', options: ['English', 'Deutsch'], updatedAt: 1 }; promptGlobals = [g];
  const p1 = pmk({ id: 'p1', template: 'A {{@Language}} B \\{{@Language}}', vars: { '@Language': { type: 'global', selected: 'Deutsch' } }, presets: [{ name: 'P', values: { '@Language': 'Deutsch' } }] });
  const p2 = pmk({ id: 'p2', template: 'Nothing here' });
  prompts = [p1, p2];
  assertDeepEqual(promptGlobalUsers(g).map(p => p.id), ['p1']);
  renamePromptGlobalValue(g, 1, 'German');
  assertEqual(p1.vars['@Language'].selected, 'German'); assertEqual(p1.presets[0].values['@Language'], 'German'); assertDeepEqual(g.options, ['English', 'German']);
  renamePromptGlobal(g, 'Target');
  assertEqual(p1.template, 'A {{@Target}} B \\{{@Language}}', 'the placeholder is renamed, an escaped one is left');
  assertDeepEqual(Object.keys(p1.vars), ['@Target']); assertEqual(p1.vars['@Target'].selected, 'German'); assertDeepEqual(Object.keys(p1.presets[0].values), ['@Target']);
  globalsSel = 'g1'; removePromptGlobalValue(1);
  assertEqual(p1.vars['@Target'].selected, ''); assertEqual(p1.presets[0].values['@Target'], ''); assertDeepEqual(g.options, ['English']);
});

test('presets include a global variable as a choice; Clear empties it; a value that no longer exists is ignored when a preset is applied', function () {
  pgfresh();
  promptGlobals = [{ id: 'g1', name: 'Tone', options: ['Formal', 'Direct'], updatedAt: 1 }];
  const p = pmk({ id: 'x', template: '{{@Tone}}', vars: { '@Tone': { type: 'global', selected: 'Formal' } }, presets: [{ name: 'Gone', values: { '@Tone': 'Poetic' } }, { name: 'Direct', values: { '@Tone': 'Direct' } }] });
  prompts = [p]; promptEditorId = 'x';
  applyPromptPreset(1); assertEqual(p.vars['@Tone'].selected, 'Direct');
  applyPromptPreset(0); assertEqual(p.vars['@Tone'].selected, '', 'a removed value is not applied');
  applyPromptPreset(1); assertTrue(promptPresetMatches(p, p.presets[1]));
  applyPromptPreset(-1); assertEqual(p.vars['@Tone'].selected, '');
});

test('globals are in the saved data and survive a load', function () {
  pgfresh();
  promptGlobals = [{ id: 'g1', name: 'Language', options: ['A'], updatedAt: 1 }];
  const d = dataPayload();
  assertEqual(d.promptGlobals.length, 1); assertTrue('deletedPromptGlobalIds' in d);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  pgfresh(); load();
  assertEqual(promptGlobals.length, 1); assertEqual(promptGlobals[0].name, 'Language');
});

test('the prompts list can be ordered like the notes list: title (default), date edited or date created, either way round', function () {
  pfresh();
  prompts = [pmk({ id: 'b', name: 'Beta', createdAt: 100, updatedAt: 300 }), pmk({ id: 'a', name: 'alpha', createdAt: 200, updatedAt: 100 }), pmk({ id: 'c', name: 'Gamma', createdAt: 300, updatedAt: 200 })];
  var ids = function () { return visiblePrompts().map(function (p) { return p.id; }); };
  setPromptSort('title'); assertDeepEqual(ids(), ['a', 'b', 'c']);
  setPromptSort('title', 'desc'); assertDeepEqual(ids(), ['c', 'b', 'a']);
  setPromptSort('edited'); assertDeepEqual(ids(), ['b', 'c', 'a'], 'newest edited first');
  setPromptSort('created', 'asc'); assertDeepEqual(ids(), ['b', 'a', 'c'], 'oldest created first');
  var h = promptSortMenuHtml(); assertIncludes(h, 'Date Edited'); assertIncludes(h, 'Date Created'); assertIncludes(h, 'Oldest First');
  setPromptSort('edited');
});

test('the Prompts columns can be resized: widths are clamped, and the default removes the setting', function () {
  assertEqual(promptsListW.set(50, false), 200); assertEqual(promptsListW.set(5000, false), 600); assertEqual(promptsListW.set(333, false), 333);
  assertEqual(promptsInspW.set(100, false), 260); assertEqual(promptsInspW.set(900, false), 560); assertEqual(promptsInspW.set(500, false, 420), 420, 'a narrow pane caps it');
  assertEqual(promptsListW.set(300, true), 300); assertEqual(promptsInspW.set(340, true), 340);
});

test('options, checklist items and presets can be reordered (the choice and the presets stay valid); a locked prompt refuses', function () {
  pfresh();
  const p = pmk({ id: 'r', template: '{{c}} [[l]]', vars: { c: { type: 'option', options: ['A', 'B', 'C'], selected: 'B' }, l: { type: 'instruction', options: ['x', 'y', 'z'], selected: ['x', 'z'] } }, presets: [{ name: 'P1', values: { c: 'A' } }, { name: 'P2', values: { c: 'C' } }] });
  prompts = [p]; promptEditorId = 'r';
  assertTrue(movePromptItem('option', 'c', 0, 2)); assertDeepEqual(p.vars.c.options, ['B', 'C', 'A']); assertEqual(p.vars.c.selected, 'B');
  assertTrue(movePromptItem('option', 'l', 2, 0)); assertDeepEqual(p.vars.l.options, ['z', 'x', 'y']);
  assertEqual(buildPromptFinal(p), 'B • z\n• x', 'the copied checklist follows the new order');
  assertTrue(movePromptItem('preset', '', 1, 0)); assertDeepEqual(p.presets.map(x => x.name), ['P2', 'P1']);
  assertFalse(movePromptItem('option', 'c', 0, 0), 'no change'); assertFalse(movePromptItem('option', 'c', 9, 0), 'out of range');
  p.locked = true; assertFalse(movePromptItem('option', 'c', 0, 1)); assertDeepEqual(p.vars.c.options, ['B', 'C', 'A']);
});

test('global values can be reordered, and the order is what every prompt shows', function () {
  pgfresh();
  const g = { id: 'g1', name: 'Tone', options: ['a', 'b', 'c'], updatedAt: 1 }; promptGlobals = [g]; globalsSel = 'g1';
  assertTrue(moveGlobalValue(0, 2)); assertDeepEqual(g.options, ['b', 'c', 'a']); assertEqual(globalsValSel, 2); assertTrue(g.updatedAt > 1);
  assertFalse(moveGlobalValue(1, 1)); assertDeepEqual(promptGlobalOptions('@Tone'), ['b', 'c', 'a']);
});

test('a fresh install can start with built-in global variables; they are added once by name and are then editable', function () {
  pgfresh();
  seedDefaultPromptGlobals([{ name: 'Tone', options: ['natural', 'professional'] }, { name: 'Language', options: ['English'] }]);
  assertEqual(promptGlobals.length, 2); assertDeepEqual(promptGlobalByName('Tone').options, ['natural', 'professional']);
  assertTrue(isSafeId(promptGlobalByName('Tone').id)); assertEqual(promptGlobalByName('Tone').id, 'gdtone', 'a fixed id, so fresh installs agree');
  promptGlobalByName('Tone').options.push('direct');
  seedDefaultPromptGlobals([{ name: 'tone', options: ['x'] }]);
  assertEqual(promptGlobals.length, 2, 'not added again, whatever the case'); assertDeepEqual(promptGlobalByName('Tone').options, ['natural', 'professional', 'direct']);
});

test('the built-in global variables: six, valid names, no clashes, and a fresh install gets them', function () {
  assertEqual(DEFAULT_PROMPT_GLOBALS.length, 6);
  pgfresh(); seedDefaultPromptGlobals();
  assertEqual(promptGlobals.length, 6, 'no two share a name or an id');
  ['language', 'language_level', 'tone', 'wording_style', 'audience', 'detail_level'].forEach(function (n) { assertTrue(!!promptGlobalByName(n), n); });
  assertDeepEqual(promptGlobalByName('tone').options, ['Professional', 'Neutral', 'Friendly', 'Formal']);
  promptGlobals.forEach(function (g) { assertTrue(isSafeId(g.id), g.id); assertTrue(g.options.length > 0); });
  localStorage.clear(); pgfresh(); load();
  assertEqual(promptGlobals.length, 6, 'load() with nothing saved seeds them'); assertTrue(!!promptGlobalOfKey('@language_level'));
  const d = dataPayload(); localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.assign({}, d, { promptGlobals: [] }))); load();
  assertEqual(promptGlobals.length, 0, 'saved data without globals is left alone');
});

function pxSetup() {
  pgfresh();
  promptFolders = [{ id: 'f1', name: 'Work', updatedAt: 1 }, { id: 'f2', name: 'Emails', parentId: 'f1', updatedAt: 1 }, { id: 'f3', name: 'Other', updatedAt: 1 }];
  promptGlobals = [{ id: 'g1', name: 'tone', options: ['Formal', 'Direct'], updatedAt: 1 }, { id: 'g2', name: 'language', options: ['English'], updatedAt: 1 }];
  prompts = [
    pmk({ id: 'p1', name: 'Reply', folderId: 'f2', template: 'Write {{@tone}} {{size}}', vars: { '@tone': { type: 'global', selected: 'Formal' }, size: { type: 'option', options: ['short', 'long'], selected: 'short' } }, presets: [{ name: 'P', values: { size: 'long' } }] }),
    pmk({ id: 'p2', name: 'Loose', folderId: '', template: 'Plain' }),
    pmk({ id: 'p3', name: 'Elsewhere', folderId: 'f3', template: 'x' }),
    pmk({ id: 'p4', name: 'Gone', folderId: '', template: 'y', deletedAt: 5 })
  ];
}

test('export: all prompts with their folders and only the global variables they use; trashed prompts are left out', function () {
  pxSetup();
  const d = buildPromptsExport('all');
  assertEqual(d.format, 'workbench-prompts'); assertEqual(d.version, 1);
  assertDeepEqual(d.prompts.map(function (p) { return p.id; }), ['p1', 'p2', 'p3']);
  assertDeepEqual(d.folders.map(function (f) { return f.id; }), ['f1', 'f2', 'f3']);
  assertDeepEqual(d.globals.map(function (g) { return g.name; }), ['tone'], 'language is not used by any prompt');
  assertDeepEqual(d.globals[0].options, ['Formal', 'Direct']);
  assertFalse('deletedAt' in d.prompts[0]);
});

test('export: one prompt brings its folder chain; a folder brings its subfolders; nothing to export gives null', function () {
  pxSetup();
  const one = buildPromptsExport('prompt', 'p1');
  assertDeepEqual(one.prompts.map(function (p) { return p.id; }), ['p1']); assertDeepEqual(one.folders.map(function (f) { return f.id; }).sort(), ['f1', 'f2']);
  const fol = buildPromptsExport('folder', 'f1');
  assertDeepEqual(fol.prompts.map(function (p) { return p.id; }), ['p1']); assertDeepEqual(fol.folders.map(function (f) { return f.id; }).sort(), ['f1', 'f2']);
  assertEqual(buildPromptsExport('folder', 'nope'), null); assertEqual(buildPromptsExport('prompt', 'p4'), null, 'a trashed prompt is not exported');
});

test('import: an export round-trips into an empty library; importing it again adds nothing', function () {
  pxSetup(); const file = JSON.parse(JSON.stringify(buildPromptsExport('all')));
  pgfresh();
  const r = importPromptsData(file);
  assertEqual(r.added, 3); assertEqual(r.skipped, 0); assertEqual(r.folders, 3); assertEqual(r.globals, 1);
  const p1 = prompts.find(function (p) { return p.id === 'p1'; });
  assertEqual(promptFolderById(p1.folderId).name, 'Emails'); assertEqual(promptFolderById(p1.folderId).parentId, promptFolders.find(function (f) { return f.name === 'Work'; }).id);
  assertEqual(p1.vars.size.selected, 'short'); assertEqual(p1.presets.length, 1);
  assertDeepEqual(promptGlobalByName('tone').options, ['Formal', 'Direct']);
  const again = importPromptsData(file);
  assertEqual(again.added, 0); assertEqual(again.skipped, 3); assertEqual(again.folders, 0); assertEqual(again.globals, 0); assertEqual(prompts.length, 3);
});

test('import: folders are matched by name and level, an existing global variable keeps its own values, a trashed or deleted id comes back', function () {
  pxSetup(); const file = JSON.parse(JSON.stringify(buildPromptsExport('prompt', 'p1')));
  pgfresh();
  promptFolders = [{ id: 'mine', name: 'work', updatedAt: 1 }]; promptGlobals = [{ id: 'gx', name: 'Tone', options: ['Mine'], updatedAt: 1 }]; deletedPromptIds = [{ id: 'p1', deletedAt: 9 }];
  const r = importPromptsData(file);
  assertEqual(r.added, 1); assertEqual(r.folders, 1, 'only Emails is new; Work matched "work"'); assertEqual(r.globals, 0);
  assertDeepEqual(promptGlobalByName('tone').options, ['Mine']);
  const p1 = prompts[0]; assertEqual(promptFolderById(p1.folderId).parentId, 'mine');
  assertFalse(deletedPromptIds.some(function (d) { return d.id === 'p1'; }), 'the old tombstone is cleared');
});

test('import: a whole Workbench export works too; unsafe ids are replaced; files without prompts are refused', function () {
  pgfresh();
  const whole = { projects: [], tasks: [], prompts: [{ id: 'a b"', name: 5, template: 'hi {{x}}', folderId: 'zz', vars: {}, presets: [] }, { id: 'ok1', name: 'Two', template: 'yo' }, { name: 'No template' }], promptFolders: [], promptGlobals: [{ name: 'tone', options: ['A'] }] };
  const r = importPromptsData(whole);
  assertEqual(r.added, 2); assertEqual(r.globals, 1);
  prompts.forEach(function (p) { assertTrue(isSafeId(p.id), p.id); assertEqual(p.folderId, ''); });
  assertEqual(importPromptsData({ prompts: [] }), null); assertEqual(importPromptsData({ nothing: 1 }), null); assertEqual(importPromptsData(null), null); assertEqual(importPromptsData([1, 2]), null);
});

test('the prompt and folder right-click menus offer Export', function () {
  pxSetup();
  assertIncludes(promptMenuHtml('p2'), 'Export Prompt'); assertIncludes(promptFolderMenuHtml('f1'), 'Export Folder');
});

test('one Import door: importKindOf tells a prompts file from a full backup, and a prompts file never goes to the Replace dialog', function () {
  assertEqual(importKindOf({ format: 'workbench-prompts', prompts: [] }), 'prompts');
  assertEqual(importKindOf({ prompts: [{ template: 'x' }] }), 'prompts', 'prompts without tasks or projects');
  assertEqual(importKindOf({ tasks: [], projects: [], prompts: [] }), 'backup'); assertEqual(importKindOf({ tasks: [], projects: [] }), 'backup');
  assertEqual(importKindOf({ nothing: 1 }), null); assertEqual(importKindOf(null), null); assertEqual(importKindOf([1]), null);
  pgfresh(); pendingImportData = null;
  finishPromptsImport({ format: 'workbench-prompts', prompts: [{ id: 'z1', name: 'N', template: 't' }] });
  assertEqual(prompts.length, 1); assertEqual(pendingImportData, null, 'no Replace / Merge choice was opened');
});
