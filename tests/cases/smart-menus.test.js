test('every sidebar view row has a right-click menu (audit V-18)', function(){
  assertIncludes(smartViewMenuHtml('notes-all'), 'New Note Here');
  assertIncludes(smartViewMenuHtml('notes-pinned'), 'New Note Here');
  assertIncludes(smartViewMenuHtml('prompts-all'), 'New Prompt Here');
  assertIncludes(smartViewMenuHtml('prompts-favorites'), 'New Prompt Here');
  ['tasks-trash','notes-trash','prompts-trash'].forEach(function(k){ assertEqual(smartViewMenuHtml(k), '', k + ' offers nothing while empty'); });
  ['taskTrashNav','allNotesNav','pinnedNav','trashNav','pAllNav','pFavNav','pTrashNav'].forEach(function(id){
    assertTrue(globalThis.__APP_HTML.indexOf('id="' + id + '" oncontextmenu="openSmartViewMenu(event,') > -1, id + ' opens its menu');
  });
});
test('a Recently Deleted row offers Delete All… only when something is in it', function(){
  trashedTasks = [{ id:'tt1', title:'x', status:'todo', projectId:'proj-inbox', subtasks:[], tags:[], deletedAt: Date.now() }];
  assertIncludes(smartViewMenuHtml('tasks-trash'), 'Delete All…');
  notes = [{ id:'nn1', title:'a', body:'', folderId:'nf-notes', deletedAt: Date.now() }];
  assertIncludes(smartViewMenuHtml('notes-trash'), 'Delete All…');
  prompts = [{ id:'pp1', name:'a', template:'', folderId:'pf-prompts', vars:{}, presets:[], deletedAt: Date.now() }];
  assertIncludes(smartViewMenuHtml('prompts-trash'), 'Delete All…');
});
