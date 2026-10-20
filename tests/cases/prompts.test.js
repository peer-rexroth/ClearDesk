// Prompts mode: the template language (detect + build), data integrity, merge, the PromptLab import, lists, and the delete / restore / folder flows.

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

test('normalizePrompts repairs the data: ids, fields, folders, variables, legacy fields, one-level folders', function () {
  prompts = [{ id: 'a b', name: 5, template: 'x {{v}}', folderId: 'gone', vars: { v: { type: 'option', options: ['A', 'B'], selected: 'A' }, stale: { type: 'text', value: 'x' } }, presets: [{ name: 'ok', values: {} }, { bad: 1 }], versions: [1], catId: 'c' }, null];
  promptFolders = [{ id: 'f1', name: 'Top' }, { id: 'f2', name: 'Sub', parentId: 'f1' }, { id: 'f3', name: 'Deep', parentId: 'f2' }, { id: 'f4', name: 'Self', parentId: 'f4' }];
  normalizePrompts();
  assertEqual(prompts.length, 1);
  const p = prompts[0];
  assertTrue(isSafeId(p.id)); assertEqual(p.name, '5'); assertEqual(p.folderId, '');
  assertDeepEqual(Object.keys(p.vars), ['v'], 'variables follow the template');
  assertEqual(p.presets.length, 1); assertFalse('versions' in p); assertFalse('catId' in p);
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

test('importPromptLabLibrary turns categories into folders, drops the version history, keeps favorites, locks and presets, and is repeatable', function () {
  pfresh();
  const lib = { version: 4, categories: [{ id: 'c1', name: 'Analysis', color: 'blue' }], prompts: [
    { id: 7, name: 'Tree', catId: 'c1', favorite: true, locked: true, template: 'A {{x}}', vars: { x: { type: 'option', options: ['1'], selected: '1' } }, presets: [{ name: 'P', values: { x: '1' } }], versions: [{ ts: 1, template: 'old' }], lastEdited: 12345 },
    { id: 8, name: 'Loose', catId: 'nope', template: 'B' }, { id: 9, name: 'Bad' }] };
  const r = importPromptLabLibrary(lib);
  assertEqual(r.added, 2); assertEqual(r.folders, 1);
  assertEqual(promptFolders.length, 1); assertEqual(promptFolders[0].name, 'Analysis');
  const t = prompts.find(p => p.name === 'Tree');
  assertEqual(t.folderId, promptFolders[0].id); assertTrue(t.favorite); assertTrue(t.locked); assertEqual(t.updatedAt, 12345);
  assertEqual(t.presets.length, 1); assertFalse('versions' in t);
  assertEqual(prompts.find(p => p.name === 'Loose').folderId, '');
  assertEqual(importPromptLabLibrary(lib).added, 0, 'importing the same file again adds nothing');
  assertEqual(promptFolders.length, 1);
  assertEqual(importPromptLabLibrary({ nothing: 1 }), null, 'a file that is not a library is refused');
  assertEqual(importPromptLabLibrary([{ id: 1, name: 'Bare', template: 'x' }]).added, 1, 'a bare array of prompts (the old format) works too');
});

test('visiblePrompts: folders include their subfolders, Favorites, Recently Deleted and a search through every folder, sorted by name', function () {
  pfresh();
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
  deletePromptFolder(fid);                                          // opens the confirmation; run its action
  modalTarget.action();
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
