# MyDesk (formerly mytasks)


**Rename note:** the app was renamed from mytasks to MyDesk. Internal storage keys (`mytasks_*` in localStorage) and the IndexedDB name `mytasks-fs` were deliberately NOT renamed, so existing users keep their data and linked file. Don't "fix" them without a migration.

A single-file task manager PWA. Everything — HTML, CSS, and JS — lives in
`mydesk.html` (~3,200 lines). There is no build step, no bundler, no
dependencies beyond a CDN Font Awesome link. Edit the file directly.

## Running it

`./start-mydesk.command` serves the directory on `http://127.0.0.1:8934` and
opens it in Chrome/Edge (Safari can't install this kind of PWA on macOS).
`./stop-mydesk.command` kills the server. A plain `file://` open also works
for quick checks, but PWA install/offline support requires the http server.

Data persists to `localStorage` by default; there's also an optional
File System Access API "linked file" sync (see `initFileSync`/`fileHandle`)
for browsers that support it (Chrome/Edge, not Safari).

## Tests

There's no lint config, but there is a test suite at `tests/`, built on the
same approach this project's history used before the suite existed: extract
the inline `<script>` block, mock just enough of the DOM
(`document.getElementById` returning cached fake elements with a settable
`innerHTML`, plus `localStorage`, `navigator`, `window`, `location`) and
`eval()` the real code in a headless JS engine (`osascript -l JavaScript` —
JavaScriptCore, no Node install needed, and none is installed in this repo's
usual dev environment). This catches real bugs that reading the code does
not — e.g. a function silently calling `renderList()` instead of the general
`render()`, breaking it when triggered from board view (`tests/cases/
render-dispatch.test.js` guards exactly this).

Run it with `./tests/run.sh` (optionally `./tests/run.sh someSubstring` to
run only tests whose name contains that substring). No install step.

Add a test by dropping a `tests/cases/*.test.js` file with `test('description',
function(){ ... })` calls — see existing files for the pattern. All app code
plus every `tests/cases/*.test.js` file get concatenated and `eval()`'d
*together* in one call, which is why a test can read/reassign `tasks`,
`projects`, and the other top-level `let` state directly by bare name, and
call any of the app's real functions — they're all sharing the same
eval'd lexical scope. `tests/harness.js` calls `resetState()` (fresh
`defaultProjects()`/`defaultTasks()` + `normalizeData()`) and clears the fake
DOM before every test, so tests never see state left over from another test
— write fixtures at the top of each test rather than relying on run order.
Helper functions declared at a test file's top level are visible to every
other test file too (same shared scope), so keep helper names distinctive
enough not to collide across files.

## Data model

```
Project { id, name, icon, locked? }
  // icon: a Font Awesome icon name from PROJECT_ICONS. Projects used to have
  // a `color` field (dot color) — replaced by icons; old saved data with
  // only `color` migrates to icon:'folder' in load().

Task {
  id, title, notes, projectId, status ('todo'|'doing'|'done'),
  priority ('high'|'medium'|'low'), dueDate, tags: [tagId],
  repeat, repeatInterval, repeatWeekdays, repeatEndDate, repeatMaxOccurrences,
  repeatOccurrenceCount, completedAt, createdAt, updatedAt,
  subtasks: [Subtask]
}

Subtask  { id, text, done, subtasks: [Step] }     // one level of children
Step     { id, text, done, subtasks: [SubStep] }  // one level of children
SubStep  { id, text, done }                        // leaf — no further nesting

Tag { id, label, color }  // color is one of CAT_COLORS' names (see below)
```

Nesting is exactly **4 levels**: task → subtask → step → sub-step. Sub-steps
are the leaf and cannot have their own children. Internally the code names
each level one "Sub" deeper than the last regardless of its UI label —
Subtask is called `subtask` in code (matches its UI name), Step is called
`SubSubtask` internally (`ss`, `subSubId`) even though the UI says "Step",
and Sub-step continues that same pattern as `SubSubSubtask` (`sss`,
`subSubSubId`) even though the UI says "Sub-step". This is a deliberate,
discussed tradeoff — verbose, but consistent with how the Step tier was
already named rather than introducing a cleaner scheme for one more level.

`promoteStepToSubtask()`/`demoteSubtaskToStep()` (Subtask↔Step boundary) and
`promoteSubSubtaskToStep()`/`demoteStepToSubSubtask()` (Step↔Sub-step
boundary) convert between adjacent levels. A promoted item's own `subtasks`
array always travels with it unmodified — nothing needs "transformation"
when moving between levels, since the field is generically named `subtasks`
at every level and a level's meaning is just "however deep its parent chain
currently is" (a Step's children are simply reinterpreted as Sub-steps once
it becomes a Subtask via promotion, and vice versa via demotion). Only the
deepest demote (`demoteStepToSubSubtask()`) can still be blocked with a
toast ("this step has its own sub-steps — remove or promote them first"),
since there's no 5th level to receive a Sub-step's children — demoting a
Subtask-with-Steps is legal (its Steps become the newly-demoted Step's
Sub-steps), unlike before Sub-steps existed.

`CAT_COLORS` is now a small palette (`blue`, `teal`, `purple`) used only for
tag colors — it used to also drive project colors before projects switched to
icons; don't add project-color code back without removing the icon system,
and don't assume `CAT_COLORS` needs all 8 original hues restored.

`STATUSES`/`PRIORITIES` are `{id, label}` only — no color/bg fields. Status
and priority visuals are driven by CSS classes (`badge-status-*`,
`badge-priority-*`), not inline colors from these arrays.

### `proj-inbox` / `proj-deleted` — locked, system-managed projects

Both are real entries in `projects` (created by `defaultProjects()`,
recreated by `normalizeData()` if a save is missing one), not sentinel
values — every task's `projectId` always resolves via `projById()`.
`locked: true` on either just means "no delete button" (`deleteProject()`
early-returns for a locked project); it does **not** control visibility.

`proj-deleted` is additionally hidden from every place that lists or offers
projects — sidebar, board columns, the drawer's project `<select>`, and the
bulk-move dropdown — via `visibleProjects()` (`projects` minus
`proj-deleted`). Any new UI that iterates `projects` to list/assign them
should go through `visibleProjects()` instead, the same way the four
existing spots do, or it'll leak a "Deleted" option/column into the UI.

`deleteProject()` splits a deleted project's tasks by status: active tasks
move to `proj-inbox` (need triage, same as any other Inbox task); completed
tasks move to `proj-deleted` instead, so they don't clutter the Inbox
list/board with old done work — they're still reachable from All Tasks,
My Day, This Week, Overdue, and search, since those don't filter by
project. `updateTaskField()` refuses `projectId: 'proj-deleted'` and
`bulkMoveProject()` refuses `'proj-deleted'` as a target, as defense in
depth (`visibleProjects()` already keeps it out of every picker, so neither
guard should be reachable through the UI — but both are cheap and this is
exactly the kind of state a future picker could reintroduce by iterating
`projects` directly instead of `visibleProjects()`).

Un-completing a task that's sitting in `proj-deleted` (via the checkbox —
`toggleTaskDone()` — or the drawer's status `<select>` —
`updateTaskField(id,'status',...)`) reassigns it to `proj-inbox`, since a
not-done task needs triage and `proj-deleted` is done-only by convention.

## Views and where features live

There are three surfaces that can show a task's subtasks/steps/sub-steps,
and they are **deliberately not at feature parity**:

- **List view** (`renderList`, `#taskList`) — the primary surface. Full CRUD
  for subtasks, steps, and sub-steps: add (inline input, Tab/Shift+Tab to
  indent/outdent — a 3-hop chain: subtask-add → step-add → sub-step-add),
  rename (dblclick), delete, promote/demote, collapse/expand (chevron,
  hover-revealed hierarchy buttons). The chevron button on a subtask/step row
  does double duty: if it has children, it collapses/expands them
  (`toggleSubCollapse`/`toggleSubSubCollapse`); if it has zero children (e.g.
  every step in a task imported from a pre-Sub-step export, or any subtask/
  step that was created and saved without ever adding a child during the
  same Tab-chain session), it instead opens that row's add-box
  (`openAddStepForSubtask`/`openAddSubStepForStep`, "+" icon) — otherwise
  there would be no way to add a first child to it ever again once the
  Tab-chain that created it had ended. Drag-reorder works **across** parents
  for subtasks/steps (`draggedItem`/`handleHierarchyDrop*`), but sub-steps
  only drag-reorder **within their own parent step** (`draggedSubstep`/
  `handleSubstepDrag*`, a deliberately separate, much simpler system — see
  "Shared state that spans views" below).
- **Drawer** (`renderDrawer`, the task detail slide-out) — same full CRUD as
  list view, plus this is the only place with a permanent (not hover-only)
  UI for it, since it's a dedicated single-task editor.
- **Board view** (`boardCardHtml`, `renderBoard`) — intentionally lighter.
  Subtasks support toggle/rename/add (mirroring list view), but steps and
  sub-steps are strictly read + toggle-done only — no rename/delete/add/drag
  for either on a card. Sub-steps share the same chevron/collapse pattern as
  steps (`collapsedSubSubIds`, the same Set list view uses, so collapsing a
  step's sub-steps in one view collapses it everywhere). There is also **no
  drag-and-drop** for subtasks/steps/sub-steps within a card. Reason:
  `.board-card` is itself `draggable="true"` for column-to-column moves;
  nesting another `draggable="true"` row inside it is unreliable across
  browsers. Card height is also a real constraint (kanban columns want
  roughly uniform heights), which is why steps (and now sub-steps) collapse
  by default there.

  Board columns are **projects**, not status (`getBoardColumns()` maps over
  `projects`, one column each). Status is a per-card badge instead, and
  dragging a card to a different column sets `projectId` (`handleBoardDrop`),
  not `status`. `taskMatchesFilters(t, opts)` has both `opts.ignoreProject`
  and `opts.ignoreStatus` for this reason: whichever field is the current
  grouping axis gets ignored by the filter (so selecting it in the sidebar/
  toolbar can't collapse the board down to one column), while the *other*
  one still filters within columns normally. Board view passes
  `{ignoreProject:true}`; list view passes no opts (both filters fully
  apply there).

When adding a subtask/step/sub-step feature, decide deliberately whether it
belongs in all three surfaces or just list view + drawer — don't assume
parity.

### Opening, editing and capturing (UX pass)

- **Double-click a list row or board card opens the drawer; a single click only
  selects it** (the original behavior — an earlier UX pass made single click
  open it and was reverted at the user's request). Double-click on the title
  renames, **F2** also renames the keyboard-selected task, and right-click / ⋯
  opens the row menu. Modifier clicks multi-/range-select as before. The
  drawer is still the docked side panel (see below), so once it is open,
  ↑/↓ move the selection and the panel together.
- **Priority, Status and Due cells are inline-editable** (`openCellPop` /
  `pickCell`): the popover is appended *inside* the clicked cell and positioned
  with CSS (`position:absolute`), not from `getBoundingClientRect()`, because
  coordinates are unreliable under the UI-scale zoom on `<html>`. `pickCell`
  goes through `updateTaskField`, so undo, `completedAt` and the recurring-task
  path behave exactly as in the drawer. Board cards expose Status and Due the
  same way (Priority there is the flag icon only).
- **Cell popovers are native-style menus** (`popOptInner`): a tick column for the current
  value, a colour dot (`PRIORITY_DOT`/`STATUS_DOT`) and plain text; hover fills the row with
  `--sel-bg` and white text, as in a macOS pop-up. The coloured pills stay in the list itself.
  The right-click menu and the toolbar dropdowns use the **same row** (`popOptInner` / `menuOpt`;
  tick for the current value — or the shared value across a multi-selection — then dot or project
  icon, then text). In the right-click menu Priority, Status, Due and Move to are **submenus**
  (`.row-menu-sub`: hover or click the parent row; `placeRowSub` flips the flyout left and nudges
  it up when it would leave the window, `toggleRowSub` is the click/touch path). `.row-menu` must
  not clip overflow (`overflow` removed) or the flyouts would be cut off. The old flat sections
  were tried first and judged too tall. Also every `.row-menu-item` now hovers accent-blue (a destructive item
  turns white on it). Add a new menu by composing `menuOpt`, not by writing a new row style.
- **Help is laid out like macOS System Settings**: a tinted sidebar on the left (round close button where the window controls
  sit, a capsule search field, the topics as inset rounded rows with the solid accent on the current one), and on the right a
  large title that follows the topic ("Search results" while searching) beside a "Keyboard shortcuts" pill that opens the shortcuts
  dialog — no header bar and no hairline between the two halves. In a narrow window the sidebar becomes a strip across the top.
- **Help is a tabbed dialog content and behaviour modelled on Milestone's** (`#helpModalBg`): a rail of topics on the left (`HELP_TABS`,
  `HELP_TAB_LABELS`; arrow keys / Home / End move between them), a search box, and short icon rows under small section
  titles on the right. The panes are *static HTML* so the search can read them: `helpSearch` shows every `.help-row` that
  contains all the words, grouped by topic with the words marked, and a topic name jumps there; Esc clears the search
  first, a second Esc closes the dialog. It reopens on the topic last read. Keyboard shortcuts are not a section here
  (the pill in its toolbar opens the separate shortcuts dialog, as do the Help menu and **?**). **When behaviour changes, update the matching row** — the
  old single-scroll Help had drifted (it still said single click opens the drawer).
- **Sidebar project actions are the list's action capsule** (`.project-actions.row-actions`): Edit/Delete float just left
  of the count on hover/focus and take no width of their own, so a project's count lines up with the nav items' counts above
  it (a reserved 46px slot used to push every project count left). Same disc hover as the list rows.
  While the capsule shows, the name gives up 76px (`margin-right` on `.pname`, which has `text-overflow: ellipsis`), so a long
  name ends in "…" before the capsule instead of running under it; `tipIfTruncated` then adds the full name as a tooltip.
- **Add-a-task is a ghost row, not a box** (after Apple Reminders' new-item line): a "+" at the row's left edge (`.qa-plus`, as it always was — the circle lined up with the checkboxes was tried and put back at the user's request), muted placeholder, a hairline under it that turns the accent colour while the field has focus (the "+" does too) (`:has(#quickAddInput:focus)`), and the project picker as a **pop-up button** (`#quickAddProject`, soft fill, stacked ⌃⌄ chevrons) that opens a shared-style popover (`quickAddProjectMenuHtml` → `pickQuickAddProject`; closed by the global click handler via `#quickAddProjectWrap`) — it used to be a native `<select>`. The list header's fold-all button is a plain glyph with a soft hover fill, no ring.
- **Enter in the quick-add field leaves it**: the new task is selected in the list (`selectTaskInList`) and the field blurred, so **Tab** adds a subtask to it straight away (↑ / N go back to the field); if a filter hides the new task (`taskIsListed`), focus stays in the field. `quickAddTask` must `stopPropagation()` on that Enter, or the list's own Enter handler takes the same keypress and opens the task.
- **Arrow keys cross the quick-add field**: ArrowDown in it selects the first task (list: first row; board: first card of
  the first non-empty column), keeping whatever you typed; ArrowUp from the first task (or a column's first card) clears the
  selection and focuses the field (`selectFirstTaskFromQuickAdd` / `leaveTasksToQuickAdd`). The field's handler must
  `stopPropagation()`: it blurs first, so the document-level list handler would otherwise take the same keypress and move
  one row further.
- **The Keyboard shortcuts dialog wears the same shell as Help** (sidebar of groups with a round close button and capsule search, a
  title on the right, a grouped softly-tinted list of rows with the keys on the right). Content is data: `shortcutGroups()` returns
  `{id,label,icon,rows:[[label,[keys]]]}` and `renderShortcutsDialog()` builds the tabs/panes when it opens (so ⌘ vs Ctrl is decided
  then); the sidebar keys, search and `/` behave as in Help (`scTabKey`, `scSearch`, `helpModalKey(e, bgId, searchId)`). Add a
  shortcut by adding a row to a group — there is no second list.
- **The Link/Create-file dialog is PromptLab's** (`.sync-modal`): a header (round blue link icon, title, one-line subtitle), a grouped tinted list of choices (Resume / Link existing / Create new, each with a round icon, a title, a description and a chevron — the Help dialog's list idiom) and a quiet amber notice. Keep it identical in both apps; the old per-colour icon tiles and amber box are gone. Unlinking still uses the generic confirm modal.
- **About is a button-less, centred panel** like macOS's About window: the real app icon (`icons/icon-192.png`, 22% corner radius), the name, a tagline, a credit line, the feedback address and a privacy line, with the same round close control as Help at the top left. No version line (the app has no version constant — don't invent one).
- **Help sections are grouped cards**: each section's rows sit in one `.help-list` (rounded, softly tinted, hairlines between rows) — the same
  look as the shortcuts dialog's `.sc-list` — and tips use the same tint; there are no divider lines between sections.
- **Help is keyboard-driven**: it opens with focus on the topic list; ↑/↓/Home/End switch topic, → (or Tab) goes into the text,
  where the browser's arrows / Page Up/Down / Space scroll (the panes are `tabindex=0`), ← goes back; **/** jumps to the search
  field (a capsule with a magnifier), ↓ from it enters the results, ↑ goes back to the topics; Tab/Shift+Tab wrap inside the
  dialog (`helpModalKey`). The shortcuts dialog lists these under "In the Help window".
- **No coloured glows.** Primary and danger buttons are flat fills (`--glass-accent` / `#d92d20`, no blurred coloured
  shadow, no gradient), and a plain `.btn` darkens on hover instead of growing a shadow. Apple's styling is flat fills with
  crisp rings; the blue/red glows were leftovers of the earlier glassier look. Hover/focus rings are crisp (no blur).
- **One width for the small option menus**: `--submenu-w` (164px, on `html`: the Due menu's natural width, the date field being its widest part) is the `min-width` of the cell popovers, the row
  menu's flyouts and the toolbar dropdowns, so Priority/Status/Due/Move look the same wherever they open. (They were 150, 190
  and 170 before.) The row menu itself (230px) is a different, larger menu.
- **Every Due menu has the date field** (`dueDateFieldHtml`, shared): the cell popover, the right-click Due submenu and the
  toolbar Due menu. Picking a date goes through `rowMenuRun('due', 'YYYY-MM-DD')` (an empty value clears), so it applies to the
  whole selection with one undo. A Due flyout stays open while the field has focus (`:focus-within`), because the browser's
  date popup is outside it and the pointer leaving would otherwise close the flyout mid-pick. Due rows have no tick column
  (`.no-tick`), so their text and the field line up; the toolbar menus are inset (`.tool-menu{padding:5px}`) like the others.
- **The Due popover opens leftwards** (`.task-cell.due .cell-pop`, and a card's due pill): the Due cell is the last
  column and the popover (170px+) is wider than it, so anchoring it at the cell's left edge ran it under the scroll
  container's edge and clipped it. Priority/Status popovers still anchor left.
- **Quick-add shorthand** (`parseQuickAdd`, live preview in `#quickAddPreview`):
  `!high/!med/!low` (`!!`, `!h`…), `#project`, `@tag`, and a date word
  (today, tomorrow, weekday, next week, in N days/weeks, YYYY-MM-DD). Unknown
  `#`/`@` tokens stay in the title; if parsing would empty the title the raw
  text is kept; Shift+Enter bypasses parsing. In My Day an undated task
  defaults to today. Date maths is anchored on `todayStr()` so it agrees with
  My Day/Overdue.
  **Default project**: the picker at the right end of the quick-add bar
  (`quickAddProjectId`, per-device `mytasks_quickadd_project`; null = Inbox).
  Precedence: explicit `#project` > the project you are *viewing* (the picker
  is then disabled and shows it) > the saved default > Inbox. A saved default
  whose project was deleted falls back to Inbox.
- **Filters live in a popover** (`#filterMenu`): the `#statusChips` /
  `#priorityChips` containers were *moved* into it, so `renderSidebar()` and
  its tests are unchanged; the Filter button shows a count and a clear (✕)
  button appears when any filter is active (`clearFilters()`).
- **Board grouping** (`boardGroup`, `'project'|'status'`, per-device in
  localStorage `mytasks_boardgroup`, not in the synced blob). In status mode
  `getBoardColumns()` returns `{project:null, status, key}` columns, ignores
  the status filter (the grouping axis, mirroring `ignoreProject`) and keeps
  the project filter; dropping a card sets `status` (`handleBoardDropStatus`).
  The completed-cap "show more" state uses key `status:<id>` in the same
  `expandedCompletedProjects` Set.
- **First-run file-sync prompt is a banner, not a modal** (`#syncBanner`,
  `showSyncBanner`): dismissed per session; the modal still opens from the
  banner/Link-file button. Sidebar bottom bar (`.sb-tools`): the Link-file status chip, then one icon-only
  capsule group (`.tool-group.topbar-tools`) of Data (export/import/daily file backup),
  Appearance (an "aA" glyph — a palette would suggest colour choices that no longer
  exist) and Help (guide, shortcuts, about), each opening its own dropdown with a
  tooltip. Menus that
  re-render themselves on click must `stopPropagation()`, or the global
  outside-click handler sees a detached target and closes them.
- **Solid accent selection** (after Apple Mail): a selected
  row/card is a solid `--sel-bg` fill (light and dark, both ≥4.5:1 vs
  white) with white text, identical for one task or many (`.kbd-selected`,
  `.bulk-selected`). `color:#fff` is set on the row itself because `color`
  inherits as a computed value — re-pointing `--text` alone would not recolour
  inherited text — and the `--text*` variables are re-pointed too for
  descendants that read them. Badges are recoloured with `!important` (tag
  badges carry inline colours); the checkbox and icon-button hovers are
  overridden explicitly. There is no keyboard ring any more: a solid fill is
  already the focus indicator. Hovering an editable cell (Priority/Status/Due on
  a row, Status/Due on a card) reacts on its **pill only**, in every row, never on
  the whole cell box: the pill brightens (`filter: brightness`, which works on every
  badge colour in both themes) and gets a soft pill-shaped halo; an empty cell shows
  a small pill behind the dash. On a selected row the pill goes translucent white. The row's action buttons (Duplicate/Delete/⋯) and the empty-Due dash hover the same way — translucent white at 45% with white content — one hover language on the blue row (a solid white disc was tried and read as louder than the pills).
  Editable cells follow macOS conventions otherwise: the pointer stays an **arrow**
  (`cursor: default` — Apple reserves the hand for links), and the pills on the
  *selected* row/card get a small chevron (`::after`, a data-URI SVG) so they read as
  pop-up buttons, as a native one does; unselected rows stay calm. The pill grows by
  the chevron's width (~14px) on selection; the columns are wide enough that no
  neighbour moves.
  **Popovers opened inside a selected row.** `.cell-pop` is appended *inside* the clicked
  cell, so it sits inside the blue `.kbd-selected` row and would inherit its white
  text, translucent-white pills, white input styling and chevron — white on the
  popover's own white surface, i.e. a blank box (this shipped once). Two guards: the
  selected-row rules for `.badge`, `.badge::after`, the pill hover and `input/select/
  textarea` all carry `:not(.cell-pop .badge)` / `:not(.cell-pop *)`, and `.cell-pop`
  re-points `--text*`/`--border*` to `--ink*`/`--ink-border*`, captured where no
  selected row has changed them (`html { --ink: var(--text) }`, and in the content
  scope for borders). Anything else that is opened inside a row must opt out the
  same way.
- **Selection changes never rebuild the list.** `paintSelection()` toggles
  `kbd-selected`/`bulk-selected` on the rows/cards that already exist (then
  refreshes the bulk bar and toolbar); `handleRowClick`, `clearSelection` and
  `openTask` use it. A rebuild repaints every row (a visible flash), drops the
  hover state under the cursor for a frame, and loses scroll/focus. `openTask`
  also skips rebuilding the panel when it already shows that task, and only
  re-renders the list if an inline add-subtask input was open (clearing that
  flag changes the rows' markup). Rows/cards deliberately have **no** colour transition: a 120ms fade was tried
  and removed — it also animates the hover highlight, so moving the pointer or
  holding an arrow key left a trail of half-faded rows (the old row still ~50%
  highlighted while the new one fades in). Selection and hover must be instant,
  as in Mail. Don't call `renderList()` just to move the highlight. Note the global Escape handler
  does still rebuild the list.
- **Selection toolbar + counts**: a capsule group in `.main-toolbar` (Complete,
  Priority ▾, Due ▾, Move ▾ | Duplicate, Delete) acts on `selectionIds()` —
  the multi-selection if any, else the single selected row — through the same
  `rowMenuRun` path as the row menu, so the two can't drift. Buttons are
  disabled with no selection; Duplicate needs exactly one. Because selection
  changes without a render (clicks, arrow keys), `updateSelectionToolbar()` also
  runs from document `click`/`keyup` listeners (deferred one tick so the row's
  own handler has run) and at the end of `renderSidebar()`. The title has a
  subtitle (`mainSubtitleText`): "N open · M overdue", plus "· K selected" for
  two or more. Cmd/Ctrl+click *extends* the current selection (the row selected
  by a plain click joins first), as in Mail/Finder.
- **One focus style (Apple Mail's colours).** The browser's default blue ring is
  replaced everywhere by the ring sampled from Mail's search field: a solid ~3pt
  band (`--focus-ring`: `#9bbcf6` periwinkle in light, `#417391` steel teal-blue in
  dark) with the control's own border taking a slightly darker edge
  (`--focus-edge`: `#89aae6` / `#3c6f8c`). Inputs/selects/textareas get it via
  `:focus-visible` with `!important` (per-component rules set `border-color` /
  `outline`, and `.field input:focus` out-ranks any normal selector — the indicator
  is restyled, never removed). Clickable non-input things (`[role=button]`, buttons,
  chips, `.th-sort`) get the same colour as a 3px outline for keyboard focus only.
  It was neutral grey for a while and was changed to these colours at the user's
  request, so the earlier "no blue" instruction applies to the *browser's* default
  blue outline, not to this ring.
  The quick-add bar rings as a whole (`:has(#quickAddInput:focus-visible)`), the
  drawer title gets an underline, inputs inside a selected row use white. As in
  Apple's apps a pop-up isn't left ringed after a mouse choice:
  `releaseSelectAfterPointerChange` blurs a `<select>` on `change` only when the
  last input was a pointer (`lastInputWasPointer`), so a keyboard user stepping
  through options with the arrow keys keeps focus. The browser's own **blue** `outline: auto` on a `<select>` is switched
  off unconditionally (`select:focus-visible { outline: none }`): Chromium paints it after a
  plain mouse click, and the custom neutral ring only exists under `html.kbd-input`, so
  before this rule a clicked dropdown was left with a system-blue border. The same modality toggles `html.kbd-input`, and a select shows the
  ring only under it — Chromium treats a *mouse click* on a `<select>` as
  `:focus-visible`, so without this the ring appeared on click. The `:where()` around the
  `:not([type=…])` exclusions keeps the selector at specificity (0,1,1) so
  the per-surface overrides can out-rank it.
- **Board cards share the list row's hover behaviour.** A card fills grey on hover (the Glass
  `.board-card` border rule used to cancel the base border change, so cards had *no* hover feedback), and shows
  the same `.row-actions` capsule (Duplicate, Delete, ⋯; Skip for repeating tasks) at the right of the meta row
  on hover/focus/selection — absolutely positioned there so it never changes card height. A card without a due
  date shows a dashed calendar chip (`.cell-host-empty`) next to the status pill on hover/selection, which opens
  the same Due menu. Still deliberately different: tags as colour strips, priority as a flag, no subtask hover controls.
  **Clicking is identical in both views**: a card uses `handleRowClick` on *click* (it used to select on
  mousedown through `selectBoardCard`, which had no modifier support), so plain click selects, Cmd/Ctrl-click
  extends and Shift-click selects a range (in on-screen card order on the board), double-click opens the panel,
  double-click on the title *text* renames and a double-click anywhere else on the card (including the blank part
  of the title line or of a subtask row) opens the panel — the board's title and subtask text are therefore
  narrow spans (`.board-card-title-text`, `.board-card .task-subtask-row span{flex:0 1 auto}`), not flex:1
  elements that would turn the whole line into a rename target. `.board-card.bulk-selected` shares every `kbd-selected` rule. The task
  title no longer swallows the click (it used to, so clicking the title text did not select the row).
- **Subtask rows follow the task row.** Subtask/step/sub-step checkboxes (`.mini-check` in the
  list and board, `.sub-check` in the panel) and the ghost add-row checkbox are *round* like
  `.task-checkbox`, just smaller; a checked one on the blue selected row is white with no green halo.
  In the list the "+ add a step" toggle of a row without children shows on hover/focus only
  (`.subtask-toggle:has(.fa-plus)`); chevrons for rows that have children stay visible.
- **Filter/tag chips (`.f-chip`) match the pills.** An active tag chip is the tag's tinted fill and text colour at
  the pills' weight (500) with no outline — it used to add a 1px border in the text colour and bold the label, so the
  same tag looked different in the sidebar than on a task row. Inactive chips stay neutral, so the fill alone says
  "on". Same in the sidebar, the filter popover and the detail panel.
- **Detail panel add fields.** The panel's add inputs live inside `.field`, whose boxed-input
  rule (`.field input[type=text]`, plus the Glass copy) out-ranks the ghost style, so they showed as
  bordered boxes beside a ghost row. A `.drawer`-scoped rule at higher specificity restores the ghost
  look and sizes the ghost checkbox like the real ones (16px, 8px gap, 18px handle column) so every
  level lines up. Indent/outdent buttons on panel rows show on hover/focus only; the expand toggle and
  delete keep their own behaviour. When overriding the hide rule, repeat its `:not()` chain.
  Panel rows are laid out like the list's: the expand chevron sits in a 16px column *left* of the checkbox
  (the toggle button is rendered before `.sub-check`; rows without one, i.e. sub-steps, keep the column
  empty via `margin-left:16px`), the grip handle is hidden (the list has none; the whole row drags in both),
  text is 14px secondary grey, and a "+" toggle shows on hover only. Ghost add rows use `padding-left:24px`
  (chevron column + gap) so their checkbox sits under the real ones.
- **Inline rename fields are quiet too** (`.task-title-input`, `.task-subtask-text-input`, the panel's
  `.sub-text-input`): no border, no focus halo, just a soft tint (translucent white on the selected row), the
  caret and the selected text. The global focus ring made them a heavy white-ringed bar across a blue row.
- **Inline add fields are a "ghost row"** (`.task-subtask-add-row`, `.add-row`):
  no box and no dashed border — a faint empty checkbox (`::before`), then the
  borderless input, with the placeholder muted and a very light tint on
  `:focus-within` (after Apple Reminders' new-item row). It is the same in the list,
  on board cards, in the panel and on the solid selection colour (white there).
  The field is focused the moment it appears, so the global focus halo is switched
  off for it — the caret and the tint are the focus indicator.
- **Row actions are an overlay in the Task cell, not a grid column** (after
  Milestone). `.row-actions` (Skip occurrence on repeating tasks, Duplicate,
  Delete, ⋯) lives inside `.task-main` as a small capsule at the cell's right end,
  visible on hover, on `:focus-within` and on the row last clicked
  (`.kbd-selected`) — and *only* there, so a multi-selection doesn't sprout a
  capsule on every row (the selection toolbar covers those). It has
  `pointer-events:none` while invisible so it never swallows a click on the title.
  The 7th grid column is gone from both the header and the rows (and from the
  drawer-open override), and `.task-main` keeps 96px of right padding so a long
  title wraps before the capsule instead of running under it.
- **Row width is a fixed floor, not `max-content`.** The list rows/header used
  `min-width: max-content`, which made any long title stretch *its own row* wider
  than the header (every row is a separate grid), pushing that row's columns out
  of line. They now use `min-width: 816px` (`560px` with the side panel open) and
  titles wrap (`overflow-wrap:anywhere`).
- **Column widths are sized to content, not guessed.** Project 152 / Priority 88 / Status 108 / Due 112px, the rest
  goes to Task. They were measured with the selected-row chevron included: Priority 78, Status 99, Project 143
  (20 characters). Due is set by the *widest locale date* (22 locales tried via `fmtDate`'s `toLocaleDateString`):
  pt-BR "28 de mar." needs 108, hu-HU 104, English only 89 — so it carries a few px of buffer. Re-measure before
  narrowing any of them. The panel-open layout (`.layout:has(.drawer.open)`) has its own, tighter widths.
- **Collapsible sidebar**: the toggle (top of the sidebar; a floating copy at the content's top-left while it is hidden) and **Cmd/Ctrl+B** flip
  `sidebarCollapsed` (per-device `mytasks_sidebar_collapsed`), applied as
  `html.sidebar-collapsed`. With no saved choice it starts collapsed at ≤800px,
  where the sidebar floats over the content; picking a project/view there closes
  it again *without* saving (so a phone-sized window never changes the wide-window
  preference). That close runs in the **capture** phase — selecting re-renders the
  sidebar, which detaches the clicked element, so a bubbling listener's
  `closest('.sidebar …')` finds nothing. The collapse CSS sits at the very end of
  the stylesheet so it wins ties with the Glass `.sidebar` border rule.
- **Sortable column headers**: Task/Project/Priority/Status/Due cycle
  ascending → descending → back to Smart order (`sortByColumn`). Direction is
  encoded *in* `sortBy` (`'due'` / `'due:desc'`, descending variants registered in
  `sortComparators`), so it saves, file-syncs and restores with no new field, and
  an unknown key just falls back to smart. Undated tasks stay last in both
  directions; completed tasks sink either way (`doneLastComparator`). The Sort
  dropdown shows the base key and always picks ascending.
- **Quiet notice bar**: the first-run sync notice is a neutral bar (small amber
  icon, one pill action, ✕), not an amber block.
- Sidebar order is Projects (with the "projects shown" control beside the +)
  then a collapsible Tags section (`mytasks_tags_collapsed`). Both sit in one scrolling `.sidebar-scroll` area, so Tags follows the last project directly (it used to be pinned to the bottom with a gap above it) and a long project list scrolls them together while the tools bar stays put.
- **The drawer is a docked side panel, not an overlay.** `#drawer` is a flex
  sibling of `.main` inside `.layout` (width 0 → 420px), with no backdrop, so
  the list stays visible and double-clicking another row swaps the panel; ↑/↓ move
  the selection *and* the panel (list view). Esc / ✕ close it. Its old
  `box-shadow` only applies when open — a fixed drawer parked just off-screen
  used to bleed a grey strip down the right edge of every screen. While it is
  open the list drops its Project column (`.layout:has(.drawer.open)`) and the
  toast moves left so neither is covered. Under 800px it floats again.
- **Row menu** (`#rowMenu`: right-click, the row's ⋯ button, or the Menu /
  Shift+F10 key — modelled on Milestone's). Targets the whole selection when
  the row is part of a multi-selection, else that row, and **never changes
  the selection** (so no bulk bar pops in and shoves the list down). Actions
  go through `rowMenuRun`, which reuses `updateTaskField` for one task and the
  `bulk*` helpers for several; those helpers take an optional explicit id
  list for exactly this reason. It is `position:fixed` on `<body>`, so
  `placeRowMenu` converts viewport px to CSS px using a scale measured from a
  real element (rect width / layout width) to stay correct under the UI-scale
  zoom. macOS note: Ctrl+click is a right-click there; multi-select is Cmd.
- **Linked-file chip** (`fileSyncChipHtml`/`onFileSyncChipClick`): one button
  like Milestone's — amber *Link file* (opens the Link/Create modal), green
  *Linked* (click → confirm → unlink), red *Reconnect*. It replaced the old
  split button + filename + unlink icon.

## Layout: Apple-Notes style, no top bar

There is **no top bar**. The sidebar runs the full window height: `.sb-head` (sidebar toggle + the Tasks | Notes `#modeSwitch`), the
search box, the lists, then `.sb-tools` (Link-file chip `#fileSyncIndicator` + the Data / Appearance / Help capsule `.topbar-tools`,
the old top bar's right-hand group) and the counts footer. Every column then starts with its own **52px** bar (`.main-toolbar`,
`.notes-list-head`, `.note-toolbar`) so the baselines line up, with a hairline under it. The first-run sync banner stays a full-width strip above
`.layout`. Rules to keep:
- The dropdown menus in `.sb-tools` open **upward** and must escape the sidebar, so `.sidebar` is `overflow: visible` (hidden again
  while collapsed) with `z-index: 60` on desktop; their inline `left/right` are overridden with `!important` in the layout block.
- While the sidebar is hidden (⌘B, or by default under 800px) `#sbFloat` — inside `.layout`, so it sits below the banner — shows a floating
  toggle plus `#fileSyncMini`, a mirror of the file-sync chip kept by a MutationObserver (icon only), and the columns' bars pad
  their left edge (`html.sidebar-collapsed … padding-left`) to make room. `applySidebarState` updates both toggles.
- Narrow windows: the sidebar and the opened drawer float from `top: 0`; the sidebar resizer is hidden.
- Notes mode hides every sidebar child except search, `#notesSide`, `.sb-head` and `.sb-tools` (the `:not()` chain in the
  `html[data-mode="notes"] .sidebar >` rule — add a new always-visible sidebar block there).
- The wordmark is gone from the UI (About, the page title and the manifest still say MyDesk).

## Shared state that spans views

A handful of module-level variables are intentionally shared across list,
board, and drawer renders, so toggling something in one view is reflected in
the others:

- `collapsedTaskIds` / `collapsedSubIds` / `collapsedSubSubIds` — Sets of
  task/subtask/step ids whose children are collapsed, all three read by both
  `renderList()` and `boardCardHtml()` (`collapsedSubSubIds`, step-level
  collapse, is new alongside sub-steps, and board renders sub-steps too —
  see "Views and where features live" above). Any function that mutates
  these must call the general `render()`, not `renderList()` or
  `renderBoard()` specifically — this exact mistake (calling the wrong one)
  has caused several real "the button does nothing" bugs.
  `toggleTaskCollapseDeep()` cycles a task through all 4 stages (task
  collapsed → subtasks visible → steps visible → sub-steps visible →
  collapse back down), touching all three Sets in turn.
- `inlineAddSubtaskTaskId` / `inlineAddParentSubId` / `inlineAddParentStepId`
  — which task/subtask/step currently has an open "add" input, and drives
  both which input renders and whether a container force-expands regardless
  of collapse state. `inlineAddParentStepId` is the 3rd hop in the Tab-chain
  (subtask-add → step-add → sub-step-add), added alongside sub-steps.
  Collapsing a task/subtask/step clears these if they pointed at it, to
  avoid a stale "still adding" flag holding a container open after the user
  tries to collapse it — every place that clears `inlineAddParentSubId`
  clears `inlineAddParentStepId` too, even sites that can't currently reach
  a non-null value for it (e.g. board's key-nav), for defense in depth.
- `draggedItem` — `{type: 'subtask'|'step', subId, stepId?}`, one unified
  drag state for both subtask- and step-level drag-and-drop (list view +
  drawer only, not board — see above). Drop-target semantics: dropping on a
  **subtask row** reorders at top level (or, if dragging a step, moves it
  into that subtask as a step); dropping on a **step row** inserts into that
  step's parent subtask (promoting/demoting as needed). Neither branch of
  `handleHierarchyDrop()` ever strips the dragged object's own `subtasks` —
  a promoted/demoted/reordered item's children always travel with it
  unmodified (only defaulted to `[]` when entirely missing), which matters
  now that a dragged Step can have its own Sub-steps.
- `draggedSubstep` — `{taskId, subId, stepId, substepId}`, a deliberately
  **separate, much simpler** drag system for sub-steps, reusing none of
  `draggedItem`'s code paths. Sub-steps only drag-reorder within their own
  parent step — `handleSubstepDragOver`/`handleSubstepDrop` both early-return
  if the dragged sub-step's `stepId` doesn't match the target row's step,
  which is the sole enforcement point for "same parent only." Moving a
  sub-step to become a step (or a step down to a sub-step) only happens via
  the promote/demote buttons, never drag-and-drop — extending the full
  cross-parent `draggedItem` system to a 3rd type was deliberately avoided
  as too large/risky a change for what sub-step drag support needed to be.
- `drawerExpandedSubIds` / `drawerExpandedStepIds` — drawer-only, independent
  from `collapsedSubIds`/`collapsedSubSubIds`, since the drawer's
  steps-panel-per-subtask (and sub-steps-panel-per-step) UI has different
  default expand/collapse behavior than list view's chevrons.

Board view specifically does **not** honor `collapsedTaskIds` for hiding a
card's entire subtask list unless it also has its own way to un-collapse it
(it does, via its own chevron + the global collapse-all button) — a task
collapsed from list view must never get permanently stuck hidden on a board
card with no way back.

## Loading data from anywhere other than `load()`

`normalizeData()` holds all the schema-migration/default-filling logic
(subtask `subtasks: []`, project `icon` fallback, tag cleanup, repeat/date
defaults, etc.) and is called by `load()` after reading from `localStorage`.
**Anything else that assigns to `projects`/`tasks` from an external source
must also call `normalizeData()` before `render()`** — `applyImport()` (both
replace and merge modes) do this; the bug this fixed
was importing an older `.json` export whose schema predated steps/project-
icons and crashing on render because nothing had migrated it. A full-app
review later found the same mistake in four separate places at once
(`linkFile()`, `reconnectFile()`, `initFileSync()`, and `fileSyncWrite()`'s
cross-tab merge branch) — all four assigned `projects`/`tasks` from an
external `.json` file without normalizing, so this is a mistake that's
genuinely easy to repeat. If you add another data-loading path (e.g. a new
sync mechanism), route it through `normalizeData()` too.

`normalizeData()` is also the security boundary for the same reason: every
id in the app is interpolated unescaped into `onclick`/`data-id` HTML
attributes at render time (`esc()` only covers *content* fields — title,
notes, subtask/step/sub-step text, project name — never `id`). That's fine for
locally-created data since `genId()` only ever produces plain alphanumeric
strings, but `mergeData()` and `applyImport('replace')` push `id`/`icon`
values from an external `.json` file in as-is. `isSafeId()` plus the
`PROJECT_ICONS`-membership check in `normalizeData()` regenerate/reject
anything that couldn't have come from `genId()` or the icon picker, closing
that off at the one place already documented above as required for every
external-data path — rather than having to `esc()` every one of the ~40
places an id gets interpolated. `t.dueDate`/`t.repeatEndDate` get the same
treatment via plain `esc()` at their two render sites (drawer date inputs)
since normalizeData() doesn't validate their shape, only fills in `null`.

## Deletion tombstones — why `mergeData()` can't just diff arrays

`deletedTaskIds`/`deletedProjectIds` (each an array of `{id, deletedAt}`) are
the record of "this id used to exist and was intentionally removed" —
without them, an id absent from `tasks`/`projects` is indistinguishable from
an id the app has simply never seen. `mergeData()` (used by the same four
spots as the section above — `linkFile()`, `reconnectFile()`,
`initFileSync()`, `fileSyncWrite()`'s cross-tab merge branch — since they're
all "read data from outside `localStorage`") is additive by id: an incoming
task/project not currently in the local array gets pushed in as new. Before
tombstones existed, that meant any of those four merge points could
resurrect a task/project the user had already deleted, simply because a
stale copy was still sitting in the linked file or on another device (the
bundled `defaultTasks()` demo tasks reappearing after "Reconnect" was the bug
report that surfaced this). `reconnectFile()`/`initFileSync()` used to do a
raw overwrite (`tasks = data.tasks`) rather than merge at all, which had the
same resurrection failure mode plus a second one — it could silently discard
local edits that hadn't made it to the file yet (e.g. during a permission
lapse). Both now route through `mergeData()`.

`deleteTask()`/`bulkDelete()`/`deleteProject()` call `tombstone(list, id)`
when removing something, and `untombstone(list, id)` in their toast undo
callback — the tombstone must not outlive the undo window, or undoing a
delete would restore the task/project locally while it stays permanently
un-mergeable from any file that still has it. `purgeOldCompletedTasks()`
(the retention-window auto-cleanup) tombstones what it purges too, since
that's the same "no longer in `tasks`" fact as a manual delete.

Inside `mergeData()`, tombstones only gate the *not-found-locally* branch —
if a task's id already exists locally, normal newer-`updatedAt`-wins logic
applies (deleted-then-not-existing-locally and existing-locally-right-now
are mutually exclusive states). A tombstoned id is skipped unless the
incoming copy's `updatedAt` is newer than the tombstone's `deletedAt`, in
which case it's treated as a genuine edit made elsewhere *after* the local
delete and is let back in (clearing the stale tombstone) — same
last-write-wins spirit as the rest of the merge, rather than a delete being
permanent no matter what happens on another device. Projects have no
`updatedAt` field, so a project tombstone has no such escape hatch: once
deleted, a project's id is never merged back in by `mergeData()` alone.

`mergeData()` also merges *incoming* `deletedTaskIds`/`deletedProjectIds`
into the local lists (union by id, keeping the later `deletedAt`), so a
deletion recorded on one device/file propagates to whichever side is doing
the reading — this is what lets tombstones do their job bidirectionally
instead of only protecting the device that performed the delete.

**The one exception: `applyImport()`'s merge mode.** `mergeData()` takes an
`opts.respectTombstones` flag (default `true`); `applyImport('merge')` is the
only caller that passes `{ respectTombstones: false }`. Picking a specific
file and clicking Import → Merge is a deliberate, one-off action — the user
is looking at that exact file and choosing to bring it in — unlike
`linkFile()`/`reconnectFile()`/`initFileSync()`/`fileSyncWrite()`, which merge
automatically in the background and where silently resurrecting a deletion
via a stale copy would be surprising. With the flag off, a matching
tombstone is cleared and the incoming item is added regardless of its
`updatedAt` relative to the tombstone's `deletedAt` — this is also the one
path that lets a *project* come back after deletion, since projects have no
`updatedAt` to compare against. Without this, manually re-importing an old
export/backup that contains anything you'd since deleted here would
silently report "0 added, 0 updated" with no indication why — which is
exactly the bug this was added to fix.

Tombstones travel through the linked-file sync payload but **not** through
the plain export/import `.json` format or the local daily-backup snapshots —
same reasoning as the equivalent note in PromptLab's CLAUDE.md.

## Look: one scheme (Glass), light and dark

The app has **one look** — Glass — in light and dark. There is no scheme picker,
no wallpaper picker, and no `colorScheme`/`glassBg` state: they were removed at
the user's request, and `save()` no longer writes `colorScheme` (an old file that
still has one is simply ignored by `load()`).

- **Theme** is `themePref` (`'light' | 'dark' | 'auto'`, default **auto**) →
  `currentTheme` (the resolved `light`/`dark` that `data-theme` shows), via
  `applyTheme()`. Auto *follows the system live* (a `prefers-color-scheme`
  change listener), not just at load. It is a **per-device preference
  (`mytasks_theme` in localStorage) and is deliberately not in the synced data
  blob**: each device should follow its own system, and a synced file must not
  push one device's choice onto another (`load()` ignores a `theme` in a file).
  It is changed from the **Appearance** popover's *Theme* control: **Light | Dark
  | Auto** with thin outlined sun / crescent-moon / half-filled-circle icons drawn
  in the SF Symbols idiom (`ICON_SUN`/`ICON_MOON`/`ICON_AUTO`, inline SVG,
  `currentColor`). The user disliked the heavy solid Font Awesome sun/moon, so
  don't swap those back.
- **One density, one of two text sizes.** The density option is gone: compact is
  the only layout (`.task-row` is `padding: 3px 10px; row-gap: 2px` in the base
  rules — it used to be switched by `html[data-density="compact"]`, which is also
  gone, along with `compactMode`/`mytasks_compact` and their save/load/sync
  entries). Text size offers only **Medium (100%) and Large (115%)** (`UI_SCALE_STEPS`), shown as a small "A" and a large "A" (each segment's `glyph` is its font size, like Safari's "aA" menu; the full name is the tooltip);
  Small and Extra Large were removed, and `clampUiScale` snaps a saved 90 to M
  and a saved 130 to L so nobody is stranded on a size the control no longer has.
- **`<html data-scheme="glass">`** is set in the markup and is now only a
  styling hook: every Glass selector is written `html[data-scheme="glass"] …`,
  and it is not toggled by script. Rewriting those to bare `html …` would lower
  their specificity and change which rules win over the base ones, so leave it.
- **`:root`** carries only `--font` and `--mono` — the two variables Glass does
  not define. Glass defines every colour variable in both themes.
- Removed with the schemes: the Standard/Modern/Dracula/GitHub/GitHub Dimmed
  variable blocks and their "signature" rules, the Standard type reverts, the
  theme-picker modal and its CSS, `THEME_SCHEMES`/`GLASS_BGS`, and the four
  wallpaper presets (Graphite, the only one kept, is the base `--wall`).
  If you ever bring a second look back, reintroduce it as a deliberate feature,
  not by resurrecting these from git history piecemeal.

- **The look** (Apple Liquid Glass / Mail-style) changes *layout and material*,
  not just colours. It copies Apple Mail's rule: **the chrome is glass, the
  content is flat.** The sidebar is translucent and blurs a soft
  graphite wallpaper on `body` (`--wall`, light and dark) — the web stand-in for
  macOS vibrancy;
  the toolbar controls are capsules; the list, board and detail panel are opaque
  and neutral; the window is flush (no floating cards). Rules to keep:
  - Content is flattened by **scoping variables**, not per-element overrides:
    `.main` and `.drawer` redefine `--bg/--bg-2/--bg-3/--glass-*/--border*` to
    opaque neutral values (light and dark), so every descendant rule that reads
    them is flat automatically. Chrome keeps the translucent values. When adding
    a Glass rule, reach for those variables rather than hard-coding colors.
  - `backdrop-filter` can't see through a parent that has its own, so only
    body-level surfaces (sidebar, row menu, modals, toast, banner) blur;
    popovers inside the content use the near-opaque `--glass-strong` (97%; at 88%
    the content underneath ghosted through the Appearance menu).
  - The light and dark blocks must define the **same** variables (the light
    block would otherwise beat bare `html[data-theme="dark"]` for any variable
    only it sets).
  - `prefers-reduced-transparency`, `prefers-contrast` and browsers without
    `backdrop-filter` get solid chrome and a flat wallpaper. Real lens
    refraction (SVG displacement) was deliberately skipped.
  - Row hover must not beat selection: hover is written
    `.task-row:hover:not(.kbd-selected):not(.bulk-selected)` (same specificity,
    later in the file, it used to erase the selected look while the mouse was
    still on the row).
  **Corner radii**: toolbar controls (sidebar header/tools bar, `.main-toolbar`, bulk bar) are
  capsules like Mail's; everything in the content uses `--radius` (10px), task
  rows `--glass-r-row` (8px), the quick-add bar `--glass-r-bar` (12px), board
  columns `--radius-lg` (14px) and menus/modals `--glass-r-menu` (16px); chips and
  badges stay pills. Change the look by editing those variables, not rules.
  **Select arrows**: Glass replaces the browser's heavy dark dropdown arrow with a thin
  light chevron (`appearance:none` + a data-URI background; one URI per theme because a
  data-URI can't read CSS variables). That rule must stay *after* every Glass rule that
  uses the `background` shorthand, which would reset the chevron (it once vanished in
  light mode and tiled across the select in dark).
  A real pointer click (`e.detail>0`) also blurs `[role="button"]` divs so a
  clicked badge cell doesn't keep a focus ring for the next key press.

## Notes (second app mode)

A OneNote/Apple-Notes-style area next to Tasks. `appMode` ('tasks'|'notes', per-device, `data-mode` on `<html>`) is switched by `#modeSwitch` / `setAppMode()`. `render()` early-returns into `renderNotes()` in notes mode; `setSearchQuery` and the main keydown listener route to the notes versions (`handleNotesKeys`).

- **Data:** `notes` `{id, title, body(HTML), folderId, created, updated}`, `noteFolders` `{id, name}`, plus tombstones `deletedNoteIds` / `deletedNoteFolderIds`. All four live in `dataPayload()` (the single saved/synced object), backups, export/import and `mergeData()` (`mergeNotesData`: newer `updated` wins, tombstones respected). Selected note / folder filter are per-device, not synced.
- **Security rule:** every path that stores or renders a note body goes through `sanitizeNoteHtml()` (string-based allowlist, no DOM, so it runs in the test harness): `normalizeNotes()` (the boundary for external data), paste, drop, and editor input. Never assign unsanitised HTML to `#noteBody`.
- **Editor:** contenteditable + `execCommand`; checklists are `<ul class="cl"><li data-done="1">` toggled by clicking the left 28px; saves are debounced 500ms; empty notes are auto-removed (tombstoned); deletes offer Undo.
- **Tables:** `table/thead/tbody/tr/th/td` are in `NOTE_TAGS` with every attribute stripped (no colspan/rowspan/styles), so pasted tables survive as plain grids. The toolbar's table button is one menu (`noteTableMenuHtml`): sizes outside a table, row/column/header/delete actions inside one. Every edit goes through `noteTableEdit`, which edits a clone and swaps it in with `execCommand('insertHTML')` so native Undo covers it (never mutate the live table directly). `noteIsEmpty` counts a table as content. Table editing is Apple Notes' approach — no second toolbar: with the caret in a table the overlay `#tblHandles` shows a "···" grip above its column and a "⋮" grip beside its row (`tblChromeSync`, run on every selection change); clicking a grip only SELECTS that column/row (`tblSel` = `{kind, a, b, cell}`, an inclusive run of columns/rows: an accent outline plus a tab, with two round handles `.tbl-dot` you drag (`tblDotDown`, document-level pointer listeners because every redraw replaces the handle) to take in neighbouring columns/rows; `noteTableEdit` takes `ref.a..ref.b` so add/delete act on the whole run) — its options show on right-click only: inside the selection or on its tab (`onNoteContextMenu` / `tblGripContext` → `tblShowMenuAt`; `noteBodyMouseDown` remembers the selection because the right-click moves the caret; elsewhere the browser's own menu stays). The menu (`tblGripMenuHtml` → `tblGripRun` → `noteTableEdit(op, ref)`) has add before/after, delete, header row on row 0, delete table. Pointing at a table also shows an edge "+" to add a column/row. The overlay lives beside `#noteBody`, so none of it is saved. Arrow keys in a table: Left/Right are native, Up/Down are handled by `noteTableArrow` (Chromium would step to the previous/next cell in document order), including stepping out above the first row and below the last is shown by `updateNoteToolbarState`; pointing at a table also shows two edge "+" buttons Every action calls `noteTableEdit(op, ref?)`.
- **Note width and table size:** `.note-doc` is capped at `--note-max-w` (900px, left-aligned in the pane), so an ultrawide window no longer stretches lines or tables; below the cap the note fills the pane as before. A NEW table is sized to its content instead of spanning the line (`noteTableWidthFor`: 22% of the note area per column, at least 35%, up to 100%), stored as `<table style="width:NN%">`; `sanitizeNoteHtml` keeps only a plain 20–99% width there (100% = no style = the old full width, which is what existing tables still are). Tables pasted or dropped in from outside get the same sizing for their column count (`noteSizeNewTables`, run in `noteInsertClean`; a table that already has a width is left alone). Add/delete column scales that width with the column count (`tblColgroupAfterColOp`), and the column-resize drag works inside it as before.
- **Insert row/column menu items** read "Insert row above / below" and "Insert column left / right" ("Insert 2 columns left" for a selection) in both table menus, with a line-and-arrow icon (`tblInsIcon`, inline SVG in `currentColor`, line at half strength, so it follows the grey text and turns white on the blue hover row). `rowMenuItem` accepts a raw `<svg…>` as its icon and `popOptInner` a `{svg}` lead for this.
- **Header row / header column:** a header row is a first row of all `<th>` (`tblHeadRow`), a header column is `<th>` as the first cell of every row below the first (`tblHeadCol`, needs 2+ rows); they combine, with the corner cell staying a header while either is on. The toggles (`noteTableEdit` ops `header` / `headerCol`) are only offered where they apply: "Header row" when the first row is selected (or the caret is in it), "Header column" when the first column is. New rows keep the header cell when a header column is on.
- **Leaving a table downward:** a note never ends in a bare table — `noteEnsureTrailingLine` appends an empty `<p>` after a trailing table when a note loads (unlocked notes) and after every edit (`onNoteInput`), so a full-width or pasted table always has a line to click or arrow into. ⌘/Ctrl+Enter in a table (`noteTableExitDown`) moves to the line below it, inserting one first (via `insertHTML`, so Undo takes it back) when the table is followed by nothing or by another table.
- **Backspace on an empty line below a table** (`noteBackspaceAfterTable`): Chrome's key handling won't step back over a table (the line could only be deleted by selecting it first), so the handler runs `execCommand('delete')` itself — one undoable edit, caret to the end of the table's last cell. A line can also be a bare `<br>` directly in the note body (caret at `body` level, not inside a block): that case selects the `<br>` and deletes it, since the plain command does nothing there. The note's LAST line stays (it is the only way to type below a table). Don't select the line first: that made Chrome merge the next block into the table and swallow it.
- **Table column widths:** drag a column border (`.tbl-colrs` strips in the `#tblHandles` overlay, shown on hover like the grips) to move width between its two neighbours — the table keeps its width, each column keeps at least `TBL_COL_MIN` (8%), double-click a border to even them out. Widths are stored as a `<colgroup>` of `<col style="width:NN%">` (only present once a column was dragged; none = equal columns); `sanitizeNoteHtml` allows `colgroup`/`col` and keeps nothing of a `col` but a 0–100 percentage width. The drag previews on the live table, then puts it back and commits through `tblCommitColWidths` (a clone swapped in with `insertHTML`, like every other table edit) so native Undo covers it. `noteTableEdit` keeps the colgroup in step for add/delete column (`tblColgroupAfterColOp`: new columns get an even share, the sum is renormalised to 100%).
- **List order:** `noteSortKey` (`edited` | `created` | `title`) and `noteSortDir`, per-device (`mytasks_notes_sort`), set from the ⋯ button in the list header (`openNoteSortMenu` → `setNoteSort`); `noteSorter()` ties fall back to newest-edited, and the row date follows the key. The list header has no tint or hairline so the column reads as one surface to the top (the other column bars keep theirs).
- **Search:** `visibleNotes()` ignores the folder filter whenever there is a query (a search always covers every folder, titled "Search results"), and `setSearchQuery` opens the first result when the open note is not one.
- **List styles:** `noteListStyle` acts on every list the selection touches (`noteListsInSelection`), not just the one under the caret, so a selection that spans a whole list, a checklist or a mix of bullets and numbers all convert; it also lifts a list out of a stray `<p>`. Two Chromium quirks it works around: in a still-empty note the caret ends up on the note (not inside the list `execCommand` just made), so the command's new lists are picked up by diffing the list elements before/after (otherwise the style only applied on the second try); and wrapping a bare line in a list drops the caret to the line's start, so the caret is saved as a text-character index and put back (`noteCaretAtTextIndex`).
- **Undo in notes:** the browser keeps ONE undo history per page, so `renderNoteEditor` swaps in a fresh `#noteBody` element whenever a different note loads (otherwise ⌘Z would reach back into the previous note). `noteEditCount` counts edits since load: with none, ⌘Z falls through to the toast's Undo (`onNoteKeydown`). The Undo/Redo buttons track `queryCommandEnabled`.
- **Notes list width:** `--notes-list-w` on `<html>` (default 300px, clamped 200–600px, per-device `mytasks_noteslist_w`), changed by dragging `#notesListResizer` (the edge between the list and the editor; same pointer/zoom/double-click/arrow-key behaviour as the sidebar's, with its own `nl-resizing` state so only this edge lights up). Hidden on narrow windows, where the list stays 220px.
- **Sidebar width:** `--sidebar-w` on `<html>` (default 300px, clamp 200–480, per-device key `mytasks_sidebar_w`), changed by dragging `#sidebarResizer` (pointer events, zoom-corrected), double-click to reset, arrow keys when focused. Hidden when the sidebar is collapsed or floating (narrow windows).
- **Editor toolbar organisation:** one row — compose, text style, undo/redo, B I U S, the blocks group (lists, checklist, table, link, eraser), then at the right the folder dropdown and the round ⋯ button (`openNoteMoreMenu`, reusing `noteMenuHtml`: Lock, Clone, Move to, Delete; it turns amber while the note is locked). The folder dropdown hides below ~880px of editor-pane width (container query on `.notes-editor-pane`) because "Move to" in ⋯ does the same job, and the bar tightens below ~760px, so it stays one 52px row down to a ~680px pane.
- **Subfolders (one level):** `folder.parentId` (absent = top level). `fixFolderParents()` is the single enforcer: run from `normalizeNotes()` and at the end of `mergeNotesData()`, it drops any parent that is missing, unsafe, itself, itself a subfolder, or on the default folder. `noteInFilter(n)` makes a folder show its subfolders' notes; counts and `orderedFolders()`/`folderPath()` follow. Deleting a folder removes its subfolders too (all tombstoned; notes go to the default folder; one Undo restores everything). Collapsed state is per-device (`mytasks_notes_collapsed`). Folders carry `order` (the sidebar sorts by it; `reorderFolder` rewrites only the moved folder, taking the midpoint between its new neighbours and renumbering the level if the gap runs out) and `updatedAt` (legacy folders count as 0). `mergeNotesData` merges folders last-writer-wins like notes, and a deleted folder only comes back if the other copy was edited after the delete. Drag-and-drop and Move up/down only reorder within one level; changing level is the Edit dialog's Location.
- **Lock / clone / right-click:** `note.locked` (real boolean only, normalised) makes a note read-only like PromptLab's lock: `renderNoteEditor` sets `contentEditable`/`readOnly`, `.note-editor.locked .note-fmt` dims the formatting controls, and `deleteNote`, `moveNote`, `commitNoteEdit`, `removeIfEmptyNote` and the checklist click all refuse. Toggling the lock bumps `updatedAt` so it wins a sync merge. `cloneNote` copies body/folder/lock as "<title> (copy)" with an Undo toast. Right-click menus (`openNoteMenu`, `openFolderMenu`) reuse the `#rowMenu` container and the shared `rowMenuItem`/`rowMenuSub` builders that the task row menu also uses.
- **Maintain:** Help "Notes" pane (`helpPane-notes`, `HELP_TABS`) and the `notes` group in `shortcutGroups()` when behaviour changes. Tests: `tests/cases/notes.test.js`; `resetState()` in the harness resets the notes globals.
- Not built yet: task linking, images/attachments, notebook-level sync decision.

## Conventions from this project's history

- Font Awesome 6.5 (`fa-solid`/`fa-regular`) via CDN, used throughout.
- New buttons should get `this.blur()` in their `onclick` (or rely on the
  global click listener that blurs any clicked `<button>`) so a lingering
  focus ring doesn't reappear on the next keypress.
- `button:focus:not(:focus-visible) { outline: none; }` is global — focus
  rings only show for real keyboard navigation, not post-click.
- Custom checkboxes are `<div role="checkbox" tabindex="0">`, not real
  `<input>`s, so there's an accessibility "echo" in the global keydown
  handler: if a `role="checkbox"`/`role="button"` div has focus, Space/Enter
  re-clicks it. That block runs *before* `handleListKeyNav`/
  `handleBoardKeyNav`, so it silently swallows Space/Enter whenever a
  checkbox happens to still be focused from a prior click — which is the
  normal case, since clicking a `tabindex="0"` div focuses it. The global
  click listener blurs `[role="checkbox"]` elements (alongside `<button>`s)
  specifically to prevent this; don't remove that without re-checking
  Space-to-collapse and Enter-to-open still work in list/board view.
- Commit messages in this repo tend to explain *why*, and call out when a
  fix was verified by execution (not just by reading), since that's the
  actual verification method available here.

## Notes: storage and sync safety
- `save()` catches a full localStorage and warns once (`storageFullWarned`) instead of throwing; the linked file is written compact (`JSON.stringify(payload)`, no indent).
- Per-note conflicts: each note has `baseAt` (the `updatedAt` last in sync with the file; set after a file write and when a merge adopts a note; legacy notes default to `updatedAt`). In `mergeNotesData`, if both sides changed a note past `baseAt` with different text, the newer stays and the other becomes a new note "<title> (conflicted copy)" in the same folder. No copy when we hadn't edited since the last sync or the text is identical.

## Linking by folder and the daily file backup
- Modelled on Milestone / Pulse. **Linking asks for the data file's folder** (`pickDataFolder()`: `showDirectoryPicker({id:'mydesk-folder', mode:'readwrite'})`, one permission); the file picker is no longer used. *Create new file* asks for a name in a small dialog (`#newFileModalBg`, default `mydesk-data`, `.json` added, path characters and existing names refused; the daily backup file is named `<name>-YYYY-MM-DD.json`) and creates it in the folder; *Link existing file* lists the folder's `.json` files that hold MyDesk data (`listDataFiles`), links the only one directly or shows the `#dataFilesModalBg` chooser, then `finishLink()` merges it. Handles are stored in IndexedDB: `linked-file` (file) and `linked-dir` (folder, `_FS.dirKey`, via `_fsGetK/_fsPutK/_fsDelK`); `_clearFileLink()` drops both. `reconnectFile()` asks the folder's permission first.
- **Daily backup**: `fileBackupIfDue()` (from `save()`, after linking and at startup; gate `lastFileBackupDay`, in memory) writes `Backup/mydesk-data-YYYY-MM-DD.json` (compact `dataPayload()`) into the linked folder. Like Milestone/Pulse: first writer each day wins (an existing file for today is left alone, probed with `getFileHandle` without `create`), best-effort and silent, never prompts, **kept forever** (nothing is deleted). No separate backup-folder pick.
- A file linked by the old picker keeps working without a folder; The Data menu row *Enable daily file backup* / *Resume daily file backup* (`fileBackupMenuAction`, `updateFileBackupUI`) exists ONLY when action is needed (file linked without a folder, or a lapsed permission) and is hidden when backups just work; for an old link, `linkBackupFolder()` asks for its folder (must contain the file, checked with `dir.resolve()`). A lapsed folder permission shows "Permission needed" there; clicking re-grants and backs up.
- Verified in Chromium through the origin-private file system with a stubbed `showDirectoryPicker` (create, same-day no-overwrite, link one file, chooser for several, legacy folder link).

**Removed:** the in-browser daily snapshots (`mytasks_backups`, `getBackups`/`maybeSnapshotBackup`/`restoreBackup`, the Backups modal and its Data-menu item). Safety copies are the daily file backup above (history on disk) and Export; the startup code deletes the old `mytasks_backups` key to free localStorage quota.

**Drag a note to a folder:** note rows (unlocked) are `draggable`; `handleNoteDragStart` sets `draggedNoteId` and a custom drag type (`application/x-mydesk-note`, no text/plain, so dropping on the editor inserts nothing; `onNoteDrop` also ignores it). The folder rows' existing drag handlers branch on `draggedNoteId`: `.drop-into` highlight while over a valid folder, drop calls `moveNote()` (so the Moved-to toast has Undo). Locked notes and the note's own folder are refused (`noteDropOk`).
