# mytasks

A single-file task manager PWA. Everything — HTML, CSS, and JS — lives in
`mytasks.html` (~3,200 lines). There is no build step, no bundler, no
dependencies beyond a CDN Font Awesome link. Edit the file directly.

## Running it

`./start-mytasks.command` serves the directory on `http://127.0.0.1:8934` and
opens it in Chrome/Edge (Safari can't install this kind of PWA on macOS).
`./stop-mytasks.command` kills the server. A plain `file://` open also works
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
  banner/topbar button. Topbar: Appearance (text size, theme, density, color
  scheme) and Help (guide, shortcuts, about) are single dropdowns. Menus that
  re-render themselves on click must `stopPropagation()`, or the global
  outside-click handler sees a detached target and closes them.
- Sidebar order is Projects (with the "projects shown" control beside the +)
  then a collapsible Tags section (`mytasks_tags_collapsed`).
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
replace and merge modes) and `restoreBackup()` do this; the bug this fixed
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

## Color scheme system

Two independent axes control appearance: `data-theme` (`light`/`dark`,
toggled by the sun/moon button, unchanged since before schemes existed) and
`data-scheme` (picked from the palette-icon button's modal). Each scheme
defines its own light *and* dark CSS variable pair, so the two axes combine
freely — e.g. `[data-scheme="dracula"][data-theme="dark"]`.

- **`THEME_SCHEMES`** (near the top of the `<script>` block) is the single
  source of truth for which schemes exist — each entry has `id`, `name`,
  `desc`, and `swatches` (three hex values shown as dots in the picker).
  `id` must exactly match a `[data-scheme="..."]` selector; nothing
  enforces this automatically except `tests/cases/theme.test.js`'s "every
  THEME_SCHEMES entry actually has a matching CSS block" test, which will
  fail loudly on a typo but won't catch a selector that exists with no
  matching `THEME_SCHEMES` entry (a harmless orphan, not a crash).
- **`:root, html[data-scheme="standard"]`** and the bare
  `html[data-theme="dark"]` block are the original, untouched palette —
  this is what renders when `data-scheme` is absent entirely, so it must
  stay exactly as-is. Every other scheme is defined as
  `html[data-scheme="x"] { ... }` (light) and
  `html[data-scheme="x"][data-theme="dark"] { ... }` (dark) — the dark
  block's extra attribute selector always wins on specificity over the
  bare `html[data-theme="dark"]`, so block order in the file doesn't
  matter for correctness.
- A handful of type/checkbox touches (bolder wordmark and task titles,
  wider-tracked section labels, a colored ring on checked checkboxes) are
  global defaults that every scheme except Standard inherits; Standard
  explicitly reverts them back to the original values in a
  `html[data-scheme="standard"] .foo { ... }` block so it stays the true
  original look rather than original colors wearing new type.
- Persistence mirrors how `theme`/`compactMode`/`viewMode` already work:
  `colorScheme` (state) + `SCHEME_KEY`/`localStorage` (fast path on load)
  + folded into the `save()`/`load()`/`fileSyncWrite()` payloads (so it
  travels through the linked-file cross-device sync too).
- **Accuracy convention**: when a scheme claims to replicate a real
  product's theme (VS Code, GitHub, Dracula, etc.), verify the actual
  values — via `WebFetch`/`WebSearch` against the real source (a theme's
  official spec page, or its GitHub repo/compiled CSS/design-token
  files) — rather than reconstructing from memory. This project has
  gotten real values wrong from memory more than once (Dracula's light
  mode, GitHub Dark Dimmed's background, VS Code Light Modern's accent
  color all needed correcting after a fetch). Where no real equivalent
  exists for something our UI needs (e.g. GitHub's semantic palette has
  no teal token; Dracula/Monokai-style dark-only themes have no official
  light mode), say so in the scheme's comment rather than presenting an
  invented value as if it were verified.
- **Glass** (Apple Liquid Glass–inspired) is the one scheme that changes
  *layout and material*, not just colors: floating rounded panels
  (`.topbar/.sidebar/.main/.drawer` with `backdrop-filter`), a wallpaper on
  `body` (`--wall`; four presets chosen with `data-glass-bg`, picker shown in
  the Colors modal only while Glass is active, stored per-device in
  `mytasks_glassbg`), pill buttons with a springy `:active`, and a specular
  rim (inset highlight + a diagonal `::after` sheen). Rules to keep:
  `backdrop-filter` can't see through a parent that has its own, so popovers
  *inside* a panel (Appearance, Filter, cell pop-over) use the near-opaque
  `--glass-strong` and only body-level surfaces (row menu, modals, toast,
  banner) blur; the light and dark blocks must define the **same** variables
  (the light block would otherwise beat bare `html[data-theme="dark"]` for any
  variable only it sets); `prefers-reduced-transparency`, `prefers-contrast`
  and browsers without `backdrop-filter` get solid surfaces and a flat
  wallpaper. Real lens refraction (SVG displacement) was deliberately
  skipped — nothing scrolls under the glass here, so it would be invisible.
- Each scheme may add its own one-off "signature" CSS rules (e.g. GitHub's
  primary button going solid green, a scheme-specific monospace treatment
  for numerics) — these live in their own scoped block further down in
  the stylesheet, separate from the variable definitions, and are called
  out by name in a comment above the scheme's variable block.

To add a scheme: add its light+dark CSS variable blocks, add any signature
rules, add a `THEME_SCHEMES` entry, and add its `id` to the sorted list in
`tests/cases/theme.test.js`'s last test. To remove one: reverse all of the
above and grep the whole repo for its id/name to catch stray comments —
past removals have left references behind that grep caught but a partial
manual removal wouldn't have.

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
