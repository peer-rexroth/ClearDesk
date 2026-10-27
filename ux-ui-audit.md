# ClearDesk – UX/UI audit v2 (consistency, design system, Apple HIG)

Audit date: 2026-10-27. **Read-only: no application or design-system file was changed.** The only file written is this report; measuring scripts, the test copy of the app and screenshots live outside the project (scratchpad). This report **replaces** the previous audit (U-01 … U-29, committed; recover it with `git show HEAD:ux-ui-audit.md` until this report is committed, afterwards with `git log -- ux-ui-audit.md`). New findings use the prefix **V-**; old IDs are cited in the *Previous ID* column.

HIG base URL: `https://developer.apple.com/design/human-interface-guidelines/` (pages are cited as `<page>`; all were fetched as Markdown on 2026-10-27).

---

## 1. Summary

**Target platform.** An installable web app (PWA) used mainly in desktop Chrome on macOS that imitates macOS, so the **macOS HIG** applies (plus `DESIGN.md` §19.6/§20 for narrow windows). **UI stack:** one HTML file, plain CSS with tokens (136 custom properties, 63 per theme in two symmetric Glass blocks) and vanilla JS; one inline-SVG icon registry (118 icons, identical to `design-system/icons.json`); system font; no framework.

**How it was verified.** Code and browser. The app was served over http from a copy (`http://127.0.0.1:8941`) and driven in headless Chrome 1400×900 over the DevTools protocol with seeded data (6 tasks with 4-level subtasks and tags, 3 notes incl. table/list/code/link/locked/pinned, 2 prompts incl. variables/favorite/locked), in light and dark, at window widths 1400 / 1000 / 860 / 800 / 740 / 680. Measured: computed styles of every visible element (type, radius, cursor, transitions, icon sizes, roles/names), hit areas by probing `elementFromPoint` on a 61×61 grid around each small control (with `:hover` forced on rows so hover-only controls were included), contrast by sampling real screenshot pixels under each text/icon (blue and grey selection, list and board, both themes), all 14 dialogs (shell metrics, focus, Tab, Esc, focus return) and 30 context/pop-up menus (items, groups, icons), toolbar wrapping at six widths. Source scans covered tokens (defined/used/light-dark symmetry/`tokens.css`), literals, spacing, cursors, transitions, icons vs registry, wording, shortcuts, per-device vs synced state, PWA files. Mouse-drag, drag-and-drop feedback, hover transitions and print/export were **not** re-exercised (see section 10).

**Overall assessment.** The token discipline is very good: type, radius, motion, shadow and colour literals are almost entirely tokenised (7 literal colour declarations in 1,800 CSS lines, 0 untokenised transition durations, 0 nameless icon-only controls, every control ≥ 20 px except three, every icon resolves, two dialog shells in use). The remaining problems are (a) **behaviour that was decided per dialog or per bar instead of once** — dialog focus handling and toolbar wrapping — and (b) **contrast and documentation drift**: several text/icon pairs fall under their threshold on the glass sidebar, in dark mode and on the grey board tile, and `DESIGN.md` / `tokens.css` no longer match the app in 15 places (a gradient the doc forbids, a text size stored differently from what the doc says, a missing dark accent in `tokens.css`, a view state that §16 says is never synced but is). Nothing here is structural; most fixes are one rule or one sentence.

**The 5 most important issues**
1. **V-01 – Dialog focus is handled per dialog.** Five dialogs (Link file, Projects shown, Global Variables, About, Compare) leave focus on the button behind them; Confirm/Project/Folder move focus in but Tab walks out of the dialog after the last button; Help/Shortcuts/AI Apps/Link file/About do not return focus. (High)
2. **V-02 – Toolbars break at ordinary window sizes.** At 1000 px with the task panel open the title wraps to four lines and the toolbar capsules overlap; Notes/Prompts toolbars wrap to two rows at ≤ 1000 px; the tasks toolbar wraps at 1400 px with the panel open. `DESIGN.md` promises one 52 px row. (High)
3. **V-03 / V-04 / V-05 / V-06 – Contrast under threshold in four places:** sidebar counts 3.8:1, destructive text in dark mode 3.4:1, the white tick on the green completed checkbox in dark mode 1.5:1, and the coloured secondary line on a grey-selected board tile (3.2:1 / 4.1:1, a regression of U-26). (Medium, all effort S)
4. **V-09 / V-10 / V-11 – The design system disagrees with the app:** primary buttons are a gradient (§1.4/§5.1 forbid it), `tokens.css` lacks the dark accent and the selection/focus tokens, and §16 says text size is synced and view state is per device while the code does the opposite. (Medium)
5. **V-08 / V-12 – Small defects with real effect:** three panel/list controls measure 17–19 px (U-11 class) and the Overdue menu's *Move to Today* has an icon name that is not in the registry, so its icon slot is empty. (Medium, effort S)

---

## 2. Root causes

| ID | Root cause | Related findings | Recommended fix | Effort |
|---|---|---|---|---|
| R1 | No shared modal controller: each dialog opens, focuses, closes and restores focus in its own function (`closeModal` only removes the class; `modalReturnFocus` is set in one place) | V-01, V-13, V-14 | One `openModal(id, {initialFocus, onClose})` / `closeModal` that records the opener, moves focus, traps Tab (or sets the page `inert`) and restores focus; one title rule in `DESIGN.md` §8 | M |
| R2 | Bars give way by pane width (container queries) but the sidebar (300), list (300) and panel (420) reserve fixed widths, so the pane the bar sees is far below its 680 px promise | V-02 | Collapse the sidebar below ~1100 px or cap list/panel by window width; add a bar-width test at 1000 / 860 / 740 / 680 | M |
| R3 | Contrast was checked on content surfaces in one state at a time; `--text-3`, `--danger`, the checked-box tick and the grey band are not tuned for the glass sidebar, dark mode and layered tints | V-03 … V-07 | Add a contrast pass (the pixel sweep used here) to the test routine; fix with `--text-2` / `--red-text` / `--bg` tokens | S |
| R4 | `DESIGN.md` and `tokens.css` are hand-extracted from the app and drift | V-09, V-10, V-11, V-20, V-24, V-28 | Generate `tokens.css` from the app's `:root` blocks; add a "what changed" line to `DESIGN.md` in the same commit as each rule change | S |
| R5 | Context menus were composed per feature; there is no menu spec (groups, icons, ellipsis, coverage) | V-12, V-17, V-18 | Add a *Menus* spec to `DESIGN.md` §5.5 (≤ 3 groups, Delete placement, ellipsis rule, icons all-or-none, coverage table per mode) and a registry check | S |
| R6 | The hit-area `::before` is applied control by control | V-08 *(fixed)* | One `.hit-20` utility applied to every control under 20 px; extend the scan to the panel | S |
| R7 | HIG deviations decided in code but not written in §12 | V-15, V-16, V-19, V-26 | Add each to `DESIGN.md` §12 with its reason (or fix) | S |
| R8 | Residual literals and one-offs in rules that predate the scales | V-21, V-22, V-23, V-27 | A test that scans CSS for off-scale font sizes, radii, cursors, `width:auto` on masks and fails on new ones | S |
| R9 | PWA shell files are not part of the "design change" routine | V-25 *(fixed: cache v2, icons precached, dark theme-color)* | Bump `CACHE_NAME` with icon/manifest changes; list all icons in the precache | S |

---

## 3. Quick wins (High or Medium severity, Effort S)

| ID | What | Why it is small |
|---|---|---|
| V-03 *(fixed)* | Sidebar counts: use `--text-2` (or raise `--text-3` alpha on the glass block) | one token in one rule; 3.8:1 → ≥ 4.5:1 |
| V-04 *(fixed)* | Destructive text in dark mode: use `--red-text` for text and keep `--danger` for fills | `.btn-text-danger`, one rule |
| V-05 *(fixed)* | Completed checkbox tick in dark mode: dark tick (`--bg`) on the light green, or a darker green fill | one rule, two colours |
| V-06 *(fixed)* | Grey selected board tile: stop stacking the tile tint under the band (or use band-only grey) | `--sel-sub-grey` / `.board-card-top` rule |
| V-08 | Three controls under 20 px: add the `::before` hit area (`.sub-check` in the panel, `.drow-skip`, `.subtask-toggle`) | three selectors |
| V-09 *(fixed)* | Primary button: make `--glass-accent` flat, or write the gradient into `DESIGN.md` §5.1 | one token or one sentence |
| V-10 *(fixed)* | `tokens.css`: add the dark `--accent`, selection, focus and `--ib-*` tokens | copy 14 lines from the app |
| V-11 *(fixed)* | Fix §2.2/§16 (text size is per device; view state is in the file but not read back) or change the code | one paragraph, or removing 8 payload keys |
| V-12 *(fixed)* | `fa-calendar-day` → `calendar-days` (or add the drawing) in the Overdue menu | one string |

---

## 4. Inventory

Counts are from the source (CSS declarations, `grep`) or from the rendered DOM census (visible elements across 9 view/theme states) as labelled.

### 4.1 Typography (rendered text runs; source tokens)
| Variant (size/weight) | Source | Where | Uses |
|---|---|---|---|
| 12/500 | token `--fs-12` | counts, chips | 121 |
| 13/400 | token | banner text, buttons | 76 |
| 14/400 | token | rows, names | 68 |
| 12/400 | token | secondary | 57 |
| 12/600 | token | section labels (uppercase) | 42 |
| 14/600 | token | board title, nav | 31 |
| 15/600 | token | list task titles | 30 |
| 14/500 | token | nav rows | 28 |
| 13/500 | token | small buttons | 19 |
| 11/600 | token | note section, aA glyph | 17 |
| 15/400 | token | note body | 12 |
| **17/700** | token, **weight differs from §2.2 (titles 600)** | main title, list title | 11 |
| 17/600 | token | dialog titles, aA | 9 |
| 13/600 | token | board column names | 7 |
| mono 12/600, 12.48/600, 12.48/400, 14/600 | **off-scale: `calc(var(--fs-13)*.96)`** | prompt placeholders and template | 20 |
| 16/500 (italic *I*), 16px ×4 literal | documented (overlays, B I U bar) | toolbar | 2 + 4 |
| 22/700 | token | Help/Shortcuts window title, note title | (inputs not in census) |
Weights in source: 400 ×3, 500 ×20, 600 ×39, 700 ×17 (only the four allowed). Families: `--font`, `--mono`.

### 4.2 Radius
| Variant | Source | Where | Uses (rendered / CSS decl.) |
|---|---|---|---|
| 999px | documented | pills, capsules, mode switch | 349 / 27 |
| 50% | documented | discs, checkboxes | 227 / 25 |
| 10px `--r-m` | token | buttons, fields, nav rows | 161 / 39 |
| 8px `--r-s` | token | rows, pop-up buttons | 42 / 21 |
| 4px `--r-xs` | token | chips, subtask rows | 32 / 28 |
| 16px `--r-xl` | token | columns, dialogs | 6 / 3 |
| 12px `--r-l` | token | bars | – / 5 |
| 9px (`calc(r-m − 1px)`), 22% (About icon) | derived / documented | selected tile top, About | 1 / 2 |
| literal 1px ×3, 2px ×2, 3px ×2 | literal | scroll thumbs, table handles | 7 |

### 4.3 Colour and tokens
| Item | Source | Count |
|---|---|---|
| Custom properties defined / used | – | 136 / 139 |
| Light vs dark Glass block | tokens | 63 = 63 (symmetric) |
| Literal colour in a declaration | literal | 7: print `#fff/#000` (1393, documented), compare diff tints (1731–1732), dead fallbacks `rgba(120,120,128,.14/.22)` (1585, 1586, 1593) |
| Defined, never used | token | `--glass-sheen`, `--glass-sheen-2`, `--ib-m`, `--elev-1`, `--elev-3`, `--accent-hover` |
| Used, never defined | token | `--edit` (`.tbl-dot`), `--note-max-w`, `--prompts-list-w`, `--prompts-insp-w` (JS/fallback; ok) |
| Defined in app, missing from `tokens.css` | token | `--bar-ctl-h`, `--focus-edge`, `--focus-ring`, `--ib-m`, `--ib-s`, `--pill-plate`, `--sel-band`, `--sel-pill`, `--sel-sub-grey`, `--sel-sub-tint`, `--shadow`, `--list-w`, `--pdf-ruler-w`, and the **dark `--accent` `#2c62c9`** |
| Inline `style=` | documented / literal | 64 (14 html, 50 js); 15 carry px/hex: all mail/print export HTML or a computed grid (documented) |

### 4.4 Surfaces and materials
Chrome (sidebar, menus, dialogs, toast, banner) is `--glass-strong` + `--glass-blur`; content (`.main`, `.drawer`, `.notes-main`) is re-scoped to opaque `--bg*` (light `#fff / #f6f6f9 / #ececf1`, dark `#1e1f24 / #26272d / #31323a`). Fallbacks for `prefers-reduced-transparency`, `prefers-contrast`, no-`backdrop-filter` exist (lines 983–990). `.modal-bg` scrim `--scrim` + `blur(4px)`.

### 4.5 Dialogs (14 `.modal-bg`, measured)
| Dialog | Shell | Width | Padding / gap | Title | Buttons (order) | Focus on open | Tab stays inside | Esc closes | Focus returns |
|---|---|---|---|---|---|---|---|---|---|
| Confirm (delete) | alert (`alertdialog`) | 340 | 24/20 · 12 | 17/600 centred | Cancel · Delete(red) | the dialog (no default) | no (leaves after 2 Tabs) | yes | yes |
| Confirm (plain) | alert | 340 | same | same | Cancel · Unlink(primary) | primary | – | yes | yes |
| Import | alert-wide (`role=dialog`) | 400 | 24/20 · 12 | "Import data" | Cancel · Replace(red) · Merge(primary) | **body** | – | yes | – |
| New/Edit project | sheet | 380 | 24 · 16 | 17/600 left | Cancel · Save | name field | no (leaves after Save) | yes | other button |
| New/Edit folder (notes, prompts) | sheet | 380 | 24 · 16 | same | Cancel · Save | name field | no | yes | other button |
| Link file / Name file / Data files | sheet (`.sync-modal`) | 420 | 24 · 16 | "Sync to a file", "Name the new file", "Choose the data file" | Cancel / Cancel · Create | **opener (not in dialog)** | **no** | yes | not the opener |
| AI Apps | sheet | 560 | 24 · 16 | "AI Apps" | Cancel · Save | first field | yes (many fields) | yes | **BODY** |
| Projects shown | sheet | 360 | 24 · 16 | "Projects shown" (12px sub-line) | Done | **opener** | **no** | yes | not the opener |
| Global Variables | window | 660 | 0 | 17/600 | Done | **opener** | **no** | yes | not the opener |
| Help / Shortcuts | window | 860 | 0 | 22/700 | – | topic tab | yes | yes | **BODY** |
| About | window | 320 | 40/28/24 | 17/600 centred | – | **opener** | **no** | yes | not the opener |
| Compare | sheet-like | 1280 | **20 · 10** | "Compare Prompts" | Close · Save Changes | **opener** | **no** | yes (asks) | yes |
All 14 carry `role`, `aria-modal`, a label. Radius 16, scrim and z-index (200, confirm 210) are identical.

### 4.6 Context and pop-up menus (measured)
| Menu | Items / groups | Submenus | Icons | Delete last, red | Notes |
|---|---|---|---|---|---|
| Task row / board card | 10 / 3 | Priority, Status, Due, Repeat, Move to (5) | all svg; Move to uses project icons | yes, ⌫ | only the two row menus have 5 submenus |
| Subtask / step / sub-step (list, board, panel) | 4–5 / 2–3 | none | all svg | yes | Make Step only when possible |
| Project row, board column header | 3 / 2 | none | all | yes (hidden when locked) | Edit has no "…" though it opens a dialog |
| Smart views (Tasks) | 1 | none | **Overdue item has an empty icon** | – | |
| Note row / note ⋯ | 8 / **4** | Export, Move to | all; submenus none | yes, own group | |
| Prompt row / ⋯ | 9 / 3 | Open in, Move to | all | yes | Open in lists ⇧⌘↵ |
| Folder (notes, prompts) | 2–3 / 1–2 | none | all | hidden for locked | |
| Prompt option / checklist item | 3 / 3 | none | all | yes (named item) | |
| Link in note | 4 / 2 | none | all | Remove Link red | |
| Sort menus (notes, prompts, list ⋯) | 5 / 2 | none | tick column, no icons | – | uniform |
Not found: any context menu on Tasks Recently Deleted row, Notes All/Pinned/Recently Deleted rows, Prompts All/Favorites/Recently Deleted rows, sidebar tags (tags by rule).

### 4.7 Toolbars (52 px bars)
Every column bar is 52 px + 1 px hairline at 1400 px (`note-toolbar` measures 53). Wrapping measured at 6 widths: see V-02. Groups per bar ≤ 3 capsules; round bar buttons have no ring; the primary action (Copy Prompt) is at the trailing end.

### 4.8 Icons
| Item | Value |
|---|---|
| Registry vs `icons.json` | 118 = 118, drawings identical; `trash` = `trash-can` (documented alias) |
| Masked `.fa-*` in DOM | 38 distinct names, all resolve a mask |
| Inline `<svg>` in DOM | 85: 55 @ 18 (`tb-ico2`), 15 @ 16 (`mi`), 6 @ 14 (copy chip), 5 @ 8×12, 2 @ 8×5, 2 @ 8×8 (stacked chevrons) |
| Name used but not in registry | `calendar-day` (1) |
| In registry, never referenced | `calendar-xmark`, `chevron-left` |
| Icons off the 12/14/16/18 scale | boxes at font-size 14 (draw 17.6 px: sidebar and nav icons, 14 names), 13 (16.4) and 12 (15.1) for `fa-plus`, `fa-forward-step` |
| Stroke ≠ 2 or filled | `bold` 2.2, `check` 2.6, `circle-info` 2.2, `list-ul` 2.4, `triangle-exclamation` 2.2 (dot); fills: `ellipsis`, `ellipsis-vertical`, `grip-vertical`, `circle-dot`, `circle-half-stroke` |
| Icon-only controls without a name | **0** |

### 4.9 Spacing (padding/margin/gap, off the 2…40 scale)
| Value | Lines | Class |
|---|---|---|
| 44, 48, 56, 58, 60, 76, 96, 104, 112 | 284, 339, 427, 523, 1266, 1321, 1342, 1387, 1512, 1601, 1704, 1760 | documented reservations (CLAUDE.md) |
| 21 | 627 | documented alignment |
| negative margins −3 … −11, −44 | 1077, 1079, 1573, 1760 | band/handle geometry |
| **18** | 1150, 1520, 1627 | off-scale choice |
| **22 / 26 / 30** | 1628, 1418, 975 | off-scale choice |
| **9 / 11 / 3** | 1079, 1714, 538, 576 | off-scale choice |

### 4.10 Motion
Durations in use: 0.12 s (164 + 50 + 41 elements) and 0.2 s (103 + 56 + 41 + 11); `0s` only for `visibility`; `.001ms` only in reduced-motion. Easings: `ease` ×42, `ease-out` ×5 (button/segment press transform), `ease-in` ×2 (row exit), `linear` ×2 (visibility delay). `transition: all` on 50 filter chips. Button press: `transform: scale(.94)`.

### 4.11 Cursors
`default` ×63 rules, `text` ×4, `col-resize` ×8, `pointer` ×3 (`a[href]`/note links/`.help-jump`, **`.pr-inc-name`, a button**), `grab` ×1 (`.sub-drag-handle`, hidden). Rendered: text 69, pointer 2 (links), col-resize 2.

### 4.12 Hover vocabulary
Row: `--bg-2` fill; capsule button: `--cap-hover`/`--pressed`; pill: brightness 1.14 + 3 px halo; board tile: soft shadow lift; `.btn`: darker fill (resting shadow `--glass-lift-1`); selected row: translucent white. The base rules `.btn:hover` and `.task-row:hover` carry `box-shadow: var(--shadow)`, overridden by Glass rules (dead code).

### 4.13 Tooltips and names
152 static `title` attributes: 99 sentence case, 17 title style (`Undo (⌘Z)`, `Close (Esc)`, `Delete Permanently`, `Hide Variables (⌥⌘I)`), 36 single words; longest ≤ 75 characters; every icon-only control has `title` and `aria-label` (0 nameless).

### 4.14 Feedback and empty states
Toast: `role=status`/`aria-live=polite`; error toast `role=alert`, still visible after 3.5 s (stays until dismissed ✓). Banners: sync and update. Tasks empty state measured: 45 px svg, opacity .4, title "No Matching Tasks", no button ✓. Notes/Prompts empty states: not found with the `.empty-state` class under a no-match search (needs visual check).

---

## 5. Findings

Severity: High = breaks expectations, usability or accessibility; Medium = visible inconsistency or failing measurement; Low = polish or documentation. Effort S/M/L as defined in the brief.

| ID | Category | Finding | Type | Locations | DESIGN.md ref | HIG ref | Previous ID | Sev. | Eff. | Root | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| V-01 *(fixed: one focus contract driven by the `open` class; 11 of 11 dialogs measured in Chrome)* | Modals / keyboard | **Focus handling differs per dialog.** Opening Link file, Projects shown, Global Variables, About and Compare leaves focus on the opener behind the scrim; 6 Tab presses never enter them. Confirm, Project and Folder move focus in but the third Tab leaves the dialog (no wrap). On Esc, focus returns to the opener only for Confirm and Compare; Help, Shortcuts and AI Apps end on `<body>`; Link file, Projects shown and About end on `#allTasksNav`. | Design-system deviation | `closeModal`/`closeAllModals` (5771–5784), `modalReturnFocus` set only at 7473; `openFileSyncModal` 10524, `openAllTasksProjectsModal` 11078, `openPromptGlobalsModal` 10264, `openAboutModal` 10523 | §6.3 (focus in, wrap, return), §9, `DIALOG-SHELL.md` §3.3 | `keyboards` (Full Keyboard Access), `accessibility` (Speech: keyboard alone) | – | High | M | R1 | One modal controller: record opener, focus `initialFocus` (first field or the dialog), trap Tab/Shift+Tab (or set the app root `inert`), restore focus on close; test it for all 14 dialogs. |
| V-02 *(fixed: sidebar floats below 1100 px, bars step down on their own width; 6 widths × 5 views measured, no bar wraps)* | Toolbars / responsive | **Bars wrap or collapse at realistic widths.** 1000 px + task panel: `main-toolbar` 133 px high, the title "All Tasks" wraps to four lines and the selection capsule overlaps Filter/Sort (screenshot `resp-1000-tasks-panel`). 1400 px + panel and 1000–680 board: 85 px. Notes/Prompts `note-toolbar` 93–133 px at ≤ 1000 px; the Prompts panel toggle drops to a second row. `#pInspector` content measures 32 px beyond the window at 1000 px. | Design-system deviation | `.main-toolbar`, `.note-toolbar`, `@container notepane` rules (1627–1628), sidebar/list/panel widths | §2.6, §7 (bar stays one row to ~680 px), §19.4, §20.3 rule 5 | `toolbars` ("avoid layouts that cause toolbar items to overflow by default") | – | High | M | R2 | Make the sidebar float below ~1100 px or cap the list/panel; collapse bar items on the *bar's own width*; add a test that fails when a bar exceeds 53 px at 1000 / 860 / 740 / 680. |
| V-03 | Contrast | Sidebar counts (12 px, `--text-3`) measure **3.81:1** on the glass sidebar in both themes (4.35:1 on content in the board/list). `DESIGN.md` claims ≥ 4.5:1 on every surface. | Design-system deviation | `.count` (`#allTasksCount`, `#allNotesCount`, `#pAllCount`, project counts) | §2.1, §9 | `accessibility` (4.5:1 up to 17 pt) | U-26 (area) | Medium | S | R3 | Counts use `--text-2` or a higher alpha on the glass block; re-measure on the wallpaper in both themes. |
| V-04 | Contrast | Destructive plain-red text in dark mode: panel **Delete** `#d92d20` on `#1e1f24` = **3.40:1** (13 px). `--danger` has one value in both themes. | Design-system deviation | `.btn-text-danger`, `--danger` (1027) | §2.1 (`--danger` same in dark), §9 | `accessibility`, `color` | – | Medium | S | R3 | Text uses `--red-text` (themed); keep `--danger` for fills only; update §2.1. |
| V-05 | Contrast | Completed checkbox in dark mode: white-ish tick (`--text` `#f5f6fa`) on the light-green fill (`--green-text` `#8ee6a4`) = **1.5:1**; the filled disc still shows state but the tick is invisible (screenshot `q2-dark-board`). | Design-system deviation | `.task-checkbox.checked` (also `.mini-check.checked`) | §2.1, §5.3 | `accessibility` (icons 3:1), `color` | – | Medium | S | R3 | Dark tick (`--bg`) on the light green, or a darker dark-mode green fill. |
| V-06 | Selection / contrast | Grey (inactive) selected **board tile**: the tile's own 6 % tint and the 18 % band stack (band measures `rgb(201,201,205)` vs `220` in a list row), so the coloured secondary line fails: *In Progress* purple 3.22:1, *due today* amber 4.07:1 (light). | Design-system deviation | `.board-card:is(.kbd-selected,.bulk-selected)` + `.board-card-top` in `html.sel-inactive` | §3 (pills ≥ 4.5:1 on grey) | `accessibility` | **U-26** (regressed on the board tile) | Medium | S | R3 | Apply the grey to the band only (leave the tile fill at `--bg`), or give the secondary line the grey-state `--ink*` colours; re-run the sweep on list and board. |
| V-07 *(fixed: measured 0 below threshold in 18 states)* | Contrast (icons) | Icons under 3:1: Pinned section thumbtack (accent) in dark **2.90**; the ⋯ glyph on the blue selected row **2.88**; the empty-due "—" **3.73** (text, needs 4.5); also 4.35 (list counts) and 4.41 (project badge, dark grey row). | Design-system deviation | `.note-section` thumbtack, `.row-actions .icon-btn` on `.kbd-selected`, `.task-cell-empty` | §9 | `accessibility` | – | Low | S | R3 | Use `--blue-text` for the thumbtack; raise the ⋯ glyph to white at 1.0; `--text-2` for the dash. |
| V-08 | Hit areas | Under 20 px after probing: panel `.sub-check` **26 × 17**, `button.drow-skip` **54 × 18**, list `.subtask-toggle` **19 × 24**; inline note links 18 px high (text). Everything else ≥ 20 (83 controls checked). | Design-system deviation | `.sub-check` (panel), `.drow-skip`, `.subtask-toggle` | §9, §5.1 | `accessibility` (macOS min 20 × 20) | **U-11** (class) | Medium | S | R6 | Add the invisible `::before` (min 20 × 20) to the three; keep the rule "measure, don't trust CSS". |
| V-09 | Buttons | **Primary buttons are a vertical gradient** (`linear-gradient(accent 90 % + white, accent)`, computed in both themes) while the guide says flat, no gradient; `CLAUDE.md` says both "no gradient" and "gradient's top is accent 90 %". | Design-system deviation + Doc gap | `--glass-accent` (1027), `html[data-scheme="glass"] .btn-primary` (945–946) | §1.4, §5.1 | `buttons` (prominent style, accent colour) | – | Medium | S | R4 | Pick one: set `--glass-accent: var(--accent)`, or document the 10 % highlight in §5.1 and fix `CLAUDE.md`. |
| V-10 | Tokens | `tokens.css` is not the app's token set: no dark `--accent` (`#2c62c9`, so a port is the light blue in dark), no `--focus-ring/edge`, `--sel-band/sub-tint/sub-grey/pill`, `--pill-plate`, `--ib-s/m`, `--bar-ctl-h`, `--shadow`. In the app: 6 tokens never used (`--elev-1`, `--elev-3`, `--accent-hover`, `--ib-m`, `--glass-sheen`, `--glass-sheen-2`), `--edit` used but never defined (`.tbl-dot`), and a 4th elevation `--shadow` the guide does not list. | Doc gap + Design-system deviation | `design-system/tokens.css`; app lines 666–667, 1027–1028, 1064–1068, 1118–1119, 1640 | §2.1, §2.3, §11.1 | `color` (supply light and dark variants) | – | Medium | S | R4 | Generate `tokens.css` from the app; delete or use the 6 dead tokens; replace `--edit`; add `--shadow` or drop it. |
| V-11 | Settings scope | **Doc and code disagree on what syncs.** `DESIGN.md` §2.2/§16 says text size is saved in the synced data and sort/view mode are per device and never synced. Code: text size is per device (`cleardesk_uiscale`, not in `dataPayload`); `dataPayload` **does** write `sortBy`, `viewMode`, `filterStatus/Priority/Tags/ProjectId`, `myDayFilter`, `thisWeekFilter`, `overdueFilter` into the linked file. | Doc gap + Design-system deviation | `dataPayload` (keys listed in 4.x), `UI_SCALE_KEY` (3108) | §2.2, §16 | – | – | Medium | S | R4 | Decide: keep view state per device only (remove 8 keys from the payload) and correct §2.2 (text size per device), or update §16. |
| V-12 | Icons / menus | The Overdue smart-view item *Move to Today* uses `fa-calendar-day`, which is **not in the registry**, so its icon slot renders empty (`[i]` instead of `svg.mi`); the guide's own signal for a missing drawing. | Design-system deviation | line 6650 | §4.2, §17 | `menus` (icons for all items or none in a group) | **U-22** (the menu itself) | Medium | S | R5 | Use `calendar-days` (or add `calendar-day`); add a test that every `fa-NAME` used in source exists in `ICONS`. |
| V-13 *(fixed)* | Wording | Sheet titles mix styles: title style (*New Project*, *AI Apps*, *Global Variables*, *Compare Prompts*) vs sentence style (*Sync to a file*, *Name the new file*, *Choose the data file*, *Projects shown*). The Import alert title *Import data* is a fragment in sentence style. `DESIGN.md` §8 states a rule only for alerts and menus. | Inconsistency + Doc gap | dialog `<h3>`s (2380–2700) | §8 | `alerts` (fragment → title style; sentence → sentence style) | – | Low | S | R1 | Add a rule for sheet titles (title style), rename the five, and make *Import Data* title style. |
| V-14 | Dialogs | Shell details differ from the docs: gap is **16** in code and `DIALOG-SHELL.md`, **14** in `DESIGN.md` §6.2; Compare is 20 px padding / 10 gap (rule: one padding and one gap for every `.modal`); *Projects shown* sub-line is 12 px (13 in `.modal-head p`); Import is an alert shell with `role="dialog"` (shell says `alertdialog`); Compare's dismiss is *Close* (rule: *Cancel*). | Inconsistency + Doc gap | `.pdiff-modal`, `#allTasksProjectsModalBg`, `#importModalBg` | §6.2, `DIALOG-SHELL.md` §1–2 | `sheets` ("Cancel (or Close)") | – | Low | S | R1 | Set §6.2 to 16; give Compare 24/16 or document it as a window; `role="alertdialog"` on Import; document *Close* for Compare. |
| V-15 | HIG deviation (undocumented) | Two sheets end in **Done only** (*Projects shown*, *Global Variables*): the HIG says always pair Done with Cancel/Back. `DESIGN.md` §6.3 states the rule but §12 does not list it as a deviation. | HIG deviation + Doc gap | `#allTasksProjectsModalBg`, `#globalsModalBg` | §6.3, §12 | `sheets` ("Provide an alternative to the Done button") | **U-25** (documented, not in §12) | Low | S | R7 | Add a §12 row (changes apply as you go; Esc and scrim-click close without loss) or add a Cancel that reverts. |
| V-16 | Keyboard | **Ctrl+Alt+C / ⌃⌘C (Copy Note)** is the HIG standard "copy formatting settings" and uses Control, which the HIG says to avoid; ⌘B toggles the sidebar in Tasks (standard: Bold). Both are documented in `CLAUDE.md`, neither in §12. No other conflicts found in 59 shortcut rows (⌘Q/W/T/⇧C/1–9 unused). | HIG deviation + Doc gap | `handleSidebarShortcut`, `copyNote` shortcut | §15 | `keyboards` (standard shortcuts; avoid Control) | – | Low | S | R7 | Add both to §12 with the reason (⌘⇧C opens the Chrome inspector); consider ⌥⌘C for Copy Note. |
| V-17 *(fixed: Delete is its own group everywhere, Notes menu is 3 groups, Edit… ellipsis, rules in §5.5; Move to icons were already present in Notes/Prompts as the folder glyph)* | Context menus | Composition rules are not met uniformly: Note row and note ⋯ menus have **4 groups** (rule ≤ 3); *Delete* is its own group in Notes/Prompts but shares a group with *Duplicate* in Tasks; *Move to* shows project icons in Tasks and none in Notes/Prompts; *Edit* (opens a dialog) has no "…" in the project menu; there is no ellipsis rule in `DESIGN.md`. | Inconsistency + Doc gap | `noteMenuHtml`, `projectMenuHtml`, `rowMenuHtml` | §5.5, §8 | `context-menus` (≈ 3 groups), `menus` (ellipsis, icons all or none) | – | Low | S | R5 | Merge *Move to* into the middle group; separate *Delete* everywhere (or nowhere); add the ellipsis and icon rules to §5.5. |
| V-18 *(fixed: menus on every sidebar row)* | Context menus | Coverage differs by mode: Tasks smart views have a menu (U-22) but Tasks *Recently Deleted*, Notes *All Notes / Pinned / Recently Deleted* and Prompts *All Prompts / Favorites / Recently Deleted* do not. | Inconsistency | `#taskTrashNav`, `#allNotesNav`, `#pinnedNav`, `#trashNav`, `#pAllNav`, `#pFavNav`, `#pTrashNav` | §5.5, §19.1 | `context-menus` ("Support context menus consistently") | **U-22** | Low | S | R5 | Give each smart row a one-item menu (*New Note Here*, *New Prompt Here*, *Delete All…* in the trash rows) or state the rule in §5.5. |
| V-19 | Sidebar | The guide says sidebar icons stay neutral grey, citing the HIG; the HIG (updated June 2026) says **sidebar icons use the accent colour by default** and follow the user's accent, fixed colours only with purpose. | HIG deviation + Doc gap | `.nav-item .lead-ico`, `.picon` | §19.1 | `sidebars`, `color` (app accent colours) | – | Low | S | R7 | Add to §12 (web app cannot read the system accent) or tint the icons with `AccentColor` where supported; correct the §19.1 rationale. |
| V-20 | Tooltips | §5.7 says only "native `title`". 17 tooltips are title style and carry shortcuts (`Undo (⌘Z)`), 99 are sentence style; the HIG: sentence case, verb first, do not repeat the control's name, 60–75 characters (all ≤ 75 ✓). | Doc gap | 152 `title=` | §5.7 | `offering-help` (tooltips) | – | Low | S | R4 | Add the four rules to §5.7 and normalise the 17. |
| V-21 *(fixed: mono 13px; title 17/700 documented)* | Typography | (a) Prompt placeholders draw at **12.48 px** (`calc(var(--fs-13)*.96)`), `.88em`, `.92em` also exist: off the seven sizes. (b) The main toolbar title renders **17/700**, §19.4 says 22/700 and §2.2 says titles are 600; 17 rules use weight 700. | Design-system deviation + Doc gap | `.ph`, lines 1422, 1926; `.main-title`, `#notesListTitle` | §2.2, §19.4 | `typography` (min 10 pt ✓) | – | Low | S | R8 | Use `--fs-12`/`--fs-13` for placeholders; decide the title style (17/700 or 17/600) and fix §2.2/§19.4. |
| V-22 *(fixed: unused icons removed, strokes documented; nav icons were already 16px)* | Icons | Drawn sizes outside 12/14/16/18: sidebar and nav icons sit in a 14 px box (17.6 px drawn, 14 names), `fa-plus` at 13/12 px (16.4/15.1). Registry: per-path strokes 2.2/2.4/2.6 and five filled-dot glyphs against "outline only, 2-unit"; two icons never referenced (`calendar-xmark`, `chevron-left`); `trash`/`trash-can` duplicate. | Design-system deviation + Doc gap | nav row rules, `ICONS` | §4.1 | `icons` (not re-fetched) | **U-09/U-10** (class) | Low | S | R8 | Size nav icons with `--ico-16`; allow "dot glyphs may be filled, details may be 2.2–2.6" in §4.1 or redraw; delete the two unused icons. |
| V-23 *(fixed)* | Cursors | `.pr-inc-name` (a button that opens another prompt) has `cursor: pointer`; `.sub-drag-handle` has `cursor: grab` on an invisible control; the guide lists only "arrow, hand on links" but the app also uses `text`, `col-resize`. Dead rules still set `width: auto` on masked icons (749). | Design-system deviation + Doc gap | lines 460, 749, 1781 | §1.5, §10.2, §10.11 | `pointing-devices` (pointing hand only for links; resize, I-beam) | – | Low | S | R8 | Remove the two rules (or call `.pr-inc-name` a link); list `text`, `col-resize`, `not-allowed` in §1.5. |
| V-24 | Motion / hover | Undocumented: `transition: all` on 50 chips; `ease-in` (row exit), `ease-out` (press transform `.2s`), button press `scale(.94)`; the board tile lifts with a shadow on hover and `.btn` rests with a `--glass-lift-1` shadow while §1.4/§3 say hover is a fill and never a shadow; base `.btn:hover` and `.task-row:hover` still set `box-shadow` (overridden). | Doc gap | 648, 674, 693, 944, 1233 | §1.4, §2.5, §3 | `motion` (brief feedback) | **U-12** (class) | Low | S | R4 | Add exit easing, press state and the tile lift to §2.5/§3; list the properties on `.f-chip`; delete the dead `box-shadow` hovers. |
| V-25 | PWA | `CACHE_NAME` is still `cleardesk-cache-v1` after two icon/manifest changes (§14: bump with every shell change); the precache omits `icon-maskable-512.png` and `icon-180.png`; `manifest.json` has light-only `background_color`; the dark `theme-color` `#1e1e1c` differs from the dark chrome (`#1e1f24` content, `#1d1f2b` solid). | Design-system deviation | `sw.js`, `manifest.json`, lines 8–9 | §14 | – | – | Low | S | R9 | Bump the cache, add both icons, set the dark theme-color to the chrome colour. |
| V-26 | Lists | Task list columns have fixed measured widths and cannot be resized; the HIG asks macOS tables to let people resize columns. Not in §12. | HIG deviation + Doc gap | `.task-list-header`, grid templates | §5.4, §12 | `lists-and-tables` | – | Low | L | R7 | Add a §12 row (widths are measured from content) or add draggable column edges. |
| V-27 | Tokens / spacing | Residuals: literal diff tints `rgba(255,69,58,.38)`, `rgba(52,199,89,.42)` (1731–1732); dead `var(--cap-fill, rgba(…))` fallbacks (1585, 1586, 1593); padding 18/22/26/30 and 3/9/11 off the scale (4.9); no automated scan for literals, off-scale sizes or cursors (the only design scan is the nameless-button test). | Design-system deviation | see 4.3, 4.9 | §2.1, §2.3, §11.9 | – | – | Low | S | R8 | Add `--diff-del/--diff-add` tokens, remove the fallbacks, snap the nine values, add `tests/cases/tokens.test.js` that scans the CSS. |
| V-28 | Doc | `DESIGN.md` statements that no longer match the app: §19.1 says the active row is `--bg-2` (code: `--cap-on`); §12 says the task row menu has **four** submenus (code: five, *Repeat* added); §12 says "29 findings" (now 29 + 28); §2.2 says text size is synced (V-11); §19.4 gives the title as 22/700 (V-21). | Doc gap | `DESIGN.md` | §19.1, §12, §19.4, §2.2 | – | – | Low | S | R4 | Apply the wording in section 8. |

---

## 6. Documented exceptions (`DESIGN.md` §12)

You asked to leave U-20, U-07, U-08 and U-27 alone; they are in §12, were checked only for drift and **raise no finding**.

| Decision | Does the code still follow it? | Does the stated reason still hold? | Note |
|---|---|---|---|
| Shortcut hints in context menus | Yes: only ⌫ (Delete) and ⇧⌘↵ (Open in) | Yes (no menu bar) | |
| No menu bar (U-20) | Yes | Yes | Shortcuts dialog lists 59 rows |
| Text size tops out at 130 % (U-08) | Yes (four stops, `zoom` on `<html>`) | Yes (browser zoom) | The doc says it is saved in the data; it is per device (V-11) |
| Compare is a modal (U-27) | Yes | Yes | Dialog is 1280 wide, padding 20 (V-14) |
| Selected row = solid accent | Yes (band + tint) | Yes | Grey tile contrast (V-06) |
| Filled red in confirmations | Yes (Delete, Replace; *Discard* via the confirm) | Yes | Plain red text elsewhere ✓ (V-04 for dark contrast) |
| Long task row menu (U-07) | Yes | Yes | Now **five** submenus; text says four (V-28) |
| Pin vs Favorite | Yes (*Unpin Note*, *Remove from Favorites*) | Yes | |
| English-only strings | Yes (dates localise: "27. Okt.") | Yes | |
| Native tooltips | Yes (152, all paired with `aria-label`) | Yes | |

---

## 7. Regressions

| Old ID / mistake | Status |
|---|---|
| **U-26** grey selection contrast | **Regressed** on the board tile (V-06): 3.22 / 4.07 vs the 4.5 rule |
| **U-11** hit areas ≥ 20 | **Partly regressed** in the panel and list chevrons (V-08) |
| U-16 icon-only names | Holds (0 nameless in 9 states) |
| U-12 motion tokens | Holds (only 0.12 s / 0.2 s computed) |
| U-10 glyph ≥ 10 px | Holds (smallest masked glyph 10 px) |
| U-14 radius aliases | Holds |
| U-15 error toast stays | Holds (`role=alert`, visible after 3.5 s) |
| U-23 / U-19 two shells, stacked confirm | Holds (Compare padding differs, V-14) |
| §10 #11 `cursor: pointer` on a control | **Back once**: `.pr-inc-name` (V-23) |
| §10 #2 masked icon `width: auto` | Dead rule only (line 749, V-23) |
| §10 #12 dimmed menu items | Holds (hidden, not dimmed) |
| §10 #13 light/dark variable symmetry | Holds (63 = 63) but five tokens are light-only (`--danger`, `--elev-*`, `--scrim*`, `--shadow-ink*`, `--glass-lift-*`); only `--danger` has a visible effect (V-04) |

---

## 8. Proposed changes to DESIGN.md

| Target | Paste-ready wording |
|---|---|
| §1.4 / §5.1 Primary | "**Primary:** an accent fill with a 10 % lighter top (`--glass-accent`), white text, no shadow or glow; white on it stays ≥ 4.5:1." *(or make the token flat and keep the current text)* |
| §2.1 `--danger` row | "`--danger` is the **fill** red `#d92d20`. Destructive **text** uses `--red-text` (light `#c4281f`, dark `#ff9a92`) so it keeps 4.5:1 on both themes." |
| §2.1 contrast bullet | "`--text-3` meets 4.5:1 on content surfaces; on the glass sidebar use `--text-2` for counts and captions (measured 3.8:1 with `--text-3`)." |
| §2.2 Text size | "Text size is a **per-device** setting (`cleardesk_uiscale`), like theme; it is not written to the data file." *(delete the exception in §16)* |
| §2.2 Titles | "Toolbar and list titles are 17/700; dialog and panel titles 17/600; window titles (Help, Shortcuts) 22/700. Weight 700 is for page titles only." |
| §2.3 Elevation | "Three levels `--elev-1/2/3` (only `--elev-2` is used today) plus `--shadow` for resting buttons and `--glass-lift-1/2` for board tiles; remove what is unused." |
| §2.5 Motion | "Exit animations use `ease-in`; a pressed button scales to .94 over `--dur-base` `ease-out`; never `transition: all`." |
| §3 Hover | "Hover is a fill for rows and capsules, a brightness change for pills and a soft shadow lift for board tiles. No other element gains a shadow on hover." |
| §3 Grey state | "On the board the grey band replaces the tile fill; the tile and the band never both tint." |
| §4.1 | "Filled dots are allowed in `ellipsis`, `grip-vertical`, `circle-dot`, `circle-half-stroke`; detail strokes 2.2–2.6 are allowed on `check`, `bold`, `circle-info`, `list-ul`, `triangle-exclamation`." |
| §5.5 Menus | "Menus have at most three groups; *Delete* is last and in its own group; items that open a dialog end in …; inside a group give every item an icon or none; every mode's smart rows have a one-item menu (*New … Here*) except trash rows (*Delete All…*)." |
| §5.7 Tooltips | "Sentence case, verb first, do not repeat the control name, ≤ 75 characters; append the shortcut in parentheses (`Undo (⌘Z)`)." |
| §6.2 | Replace "gap 14px" with "gap 16px". |
| §6.3 | "Every dialog opens through one function that records the opener, focuses the first field (or the dialog when there is none), traps Tab and returns focus on close." |
| §8 | "Sheet titles use title style (*New Project*, *Sync to a File*). Alert titles that are sentences use sentence style; fragments use title style (*Import Data*)." |
| §12 (new rows) | "Done-only sheets (*Projects shown*, *Global Variables*): HIG pairs Done with Cancel; changes apply live and Esc/scrim close without loss." · "Ctrl+Alt+C copies a note: HIG avoids Control and reserves ⌃⌘C for copy formatting; ⌘⇧C opens the Chrome inspector." · "Sidebar icons are neutral grey: the HIG tints them with the accent colour; a web app cannot read the system accent." · "Task list columns are not resizable: widths are measured from content." · "Four → five submenus in the task row menu." |
| §16 | "Sort, view mode, filters and the open item are per device and are **not** written to the data file." *(requires removing eight payload keys, V-11)* |
| §19.1 Current location | "The active row is `--cap-on` (neutral, 18 %) with weight 600." |
| §19.4 | Replace "(22 / 700 …)" with "(17 / 700 …)". |
| §11 step 9 | "Add `tokens.test.js`: fails on literal colours, off-scale sizes/radii, `cursor: pointer` on controls, `width:auto` on masks, unknown `fa-` names." |

---

## 9. Porting checklist status (`DESIGN.md` §11)

| # | Item | Status | Note |
|---|---|---|---|
| 1 | Copy `tokens.css`, theme switch | **Partial** | Missing dark accent and 13 tokens (V-10) |
| 2 | System font, 7 sizes, 4 weights, cursor rules | **Done** | 12.48 px placeholders and two cursors (V-21, V-23) |
| 3 | Icon registry + vocabulary | **Done** | One name missing (V-12), oddities (V-22) |
| 4 | Shell: sidebar, 52 px bars, gutter, glass on chrome | **Partial** | Bars wrap at ≤ 1000 px (V-02) |
| 5 | Components in order | **Done** | Primary gradient (V-09) |
| 6 | Selection zones and the one focus ring | **Partial** | Grey board tile contrast (V-06); focus ring sampled once (solid 3 px `#9bbcf6`), full traversal needs a visual check |
| 7 | Behaviours (Undo toast, soft delete, Esc/Return, focus return) | **Partial** | Focus in/trap/return per dialog (V-01) |
| 8 | Motion tokens and fallbacks | **Done** | Reduced motion/transparency/contrast media queries present |
| 9 | Contrast and hit-area pass, automated scan | **Partial** | Only the nameless-button scan exists (V-27); passes done here show V-03…V-08 |
| 10 | Write the exceptions down | **Done** | Plus the unlisted ones in V-15, V-16, V-19, V-26 |

---

## 10. Needs visual check

- Focus-ring uniformity across control types: the Tab traversal in the test stayed on one element, so only the sidebar row was sampled (3 px `#9bbcf6`, no box-shadow).
- Notes and Prompts empty states (search with no match returned no `.empty-state` element).
- Link popover: whether Esc or an outside click discards typed text (HIG *popovers*: always save work on automatic close).
- One-pop-up-at-a-time (§10 #16) was not re-tested.
- Context menu on the prompt variable name (`.pr-var-name` returned no menu on the first element; the template highlight copy has the same class).
- Drag-and-drop feedback (accent line, not-allowed pointer), hover transitions, scrolling feel, print and e-mail export.
- Stroke weight of the chevron data-URIs and the 8 × 12 stacked-chevron svgs (not re-measured).
- `#pInspector` content overflow at 1000 px: measured 32 px past the window edge; it may be clipped by its container.
- Safari/Firefox rendering; the glass sidebar over a real wallpaper (contrast was composited over a flat approximation for translucent chrome, then confirmed from pixels for counts).

---

## 11. Skipped categories

| Category | Reason |
|---|---|
| Menu bar | Documented exception (no menu bar in a web app); only checked that the sidebar menus and Shortcuts dialog cover the commands |
| Localization / text overflow in other languages | English-only is documented; only date formatting (`toLocaleDateString`, German locale seen) and long-string wrapping (long titles) were checked |
| Loading indicators | All data is local; no spinner/skeleton exists or is needed |
| Forms and validation | Only the folder/project/file-name sheets and the link popover; validation is inline and on submit (not compared further) |
| Window management / multi-window | One browser/PWA window |
| Print and e-mail export | Not exercised (code only; literals are the documented exception) |
