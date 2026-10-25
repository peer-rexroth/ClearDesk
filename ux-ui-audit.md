# ClearDesk – UX/UI audit (consistency + Apple HIG)

Audit date: 2026-10-25. **Read-only: no application code was changed.** Scope: `cleardesk.html` (11,195 lines, one file) in its three modes (Tasks, Notes, Prompts), its dialogs, menus, popovers and the Compare view.

This report **replaces** the previous audit (A-01 … A-41, which is committed; recover it with `git show HEAD:ux-ui-audit.md`). Findings here use the prefix **U-**. Items the previous audit closed (narrow-window Prompts layout, undoable deletes, Recently Deleted for Tasks, toast live region, icon vocabulary) were re-checked against the code and are **not** repeated unless a gap is left.

**How the evidence was gathered**
- HIG pages fetched as Markdown on 2026-10-25 from `developer.apple.com/design/human-interface-guidelines/<page>.md`: **sheets, context-menus, alerts, typography, accessibility, the-menu-bar**. The summary of the *typography* and *menu bar* pages was read from the saved page (only the tables and section headings were used). Pages that earlier audits fetched (modality, menus, toolbars, buttons, color, lists-and-tables, layout, popovers, windows, drag-and-drop, motion, feedback, undo-and-redo, icons) were **not re-fetched**; where a finding leans on one of them it says so and cites the URL.
- Code was searched and counted with `grep` on the current file (counts below are exact for the patterns named). Line numbers refer to the current `cleardesk.html`.
- **No screenshots were taken in this audit and the app was not run.** Everything about computed colour, rendered size, hover look or focus order is therefore listed in section 7 as *needs visual check*.

---

## 1. Summary

**Platform and stack.** An installable web app (PWA) used mainly in desktop Chrome/Edge on macOS, so the macOS HIG applies. Plain HTML/CSS/vanilla JS in one file, no framework, no build step. One look ("Glass", light and dark), a single inline-SVG icon registry (`ICONS`, drawn at 12/14/16/18 px), system font stack, and design tokens for colour, type (`--fs-11…22`), radius (`--r-xs…xl`), icon size and elevation.

**Overall assessment.** Token discipline is strong: 211 `font-size` declarations use a type token against about 30 literals (mostly 6–10 px control glyphs); radii are 101 token uses against a handful of 1–6 px literals plus 29 pill (`999px`); only 24 lines carry hex colours outside token definitions and almost all of those are deliberate (theme-color meta, print CSS, e-mail export HTML). Delete is now undoable in all three modes, dialogs close through one function, all 15 dialogs carry `role` and `aria-modal`, and reduced-motion is respected. What is left is mostly **structural**: dialogs come in three different shells and do not agree on button wording or which button is default; context menus were added feature by feature, so some objects (subtasks, steps, tags) have none; several deliberate web-oriented departures from the HIG (dim instead of hide, shortcut hints in context menus, Cancel as the default in a delete confirm) are documented in `CLAUDE.md` but still deviate; and the web platform limits text scaling (90–130 %) and localisation (English only).

**The 5 most important issues**
1. **U-01 / U-02 – Dialog buttons are not consistent or HIG-ordered.** The destructive confirm focuses Cancel (the HIG says do not make Cancel the default); the Import dialog puts the destructive *Replace* in the trailing/default slot; confirm buttons are *Save*, *Create*, *Done* or *Merge/Replace* depending on the dialog. (Medium)
2. **U-06 – Context-menu coverage is uneven.** Tasks, notes, prompts, folders and table parts have one; subtasks/steps/sub-steps (list, board, panel), tags and board columns do not. (Medium)
3. **U-27 – The Compare view is a modal sheet for a repeat-edit-and-observe task**, which the HIG says belongs in a panel or window. (Medium, large effort)
4. **U-08 – Text size tops out at 130 %** (the HIG asks for at least 200 %); browser zoom is the only way beyond. (Medium)
5. **U-04 – Context menus dim unavailable items instead of hiding them**, contrary to the context-menu page (a previously decided exception). (Medium, small effort if reversed)

---

## 2. Root causes

| ID | Root cause | Related findings | Recommended fix | Effort |
|---|---|---|---|---|
| R1 | Inline `style="…"` and local literals bypass the tokens (91 inline styles, 44 with px/hex literals; ~30 literal `font-size`s; off-scale paddings 3/5/7/9/18/21/22 px) | U-09, U-10, U-13 | Move inline styles into classes using tokens; add a `--sp-*` spacing scale and lint for literals in a test | M |
| R2 | Three dialog shells (plain `.modal`, settings-style Help/Shortcuts, `.sync-modal`) and no shared "button row" contract | U-01, U-02, U-03, U-27, U-29 | One `dialogButtons({cancel, primary, danger})` builder that fixes order, labels, default focus and Escape | M |
| R3 | Documented web-oriented exceptions to the HIG (dim not hide, hints in context menus, Cancel-default) | U-01, U-04, U-05 | Decide per exception: keep and record the reason in the HIG-deviation list, or revert | S |
| R4 | Context menus were added per feature, not from a coverage rule | U-06, U-22 | Rule: every selectable object with commands gets a context menu built from the shared builders | M |
| R5 | Web-platform limits (no menu bar, zoom-based text scale, English strings in code) | U-08, U-20, U-24 | Offer 150 %/200 % steps; move strings to a table before any translation | L |
| R6 | Motion and hit-area values tuned locally per component | U-11, U-12, U-16 | One motion table (3 durations, 2 easings) and one `.hit` utility for sub-20 px controls | M |
| R7 | Terms grew per mode | U-21 | Glossary of terms (see section 6) | S |

---

## 3. Quick wins (High or Medium severity, Effort S)

| ID | What | Why it is small |
|---|---|---|
| U-02 | Reorder / restyle the Import dialog so the destructive *Replace* is not the trailing default; make *Merge* the default | one button row (lines 2322–2324) |
| U-04 | Hide, rather than dim, unavailable context-menu items (keep dimmed only Cut/Copy/Paste-style items) | `rowMenuItem` has one `o.off` switch (line 4033); decision already documented, so this is a policy call |

---

## 4. Inventory

Counts come from `grep` on the current file unless stated.

### Typography
| Variant | Where | Uses |
|---|---|---|
| `--fs-11` … `--fs-22` (11, 12, 13, 14, 15, 17, 22 px) | all text | 26 / 58 / 62 / 33 / 15 / 9 / 7 (+1 inline) |
| Literal sizes 6–10 px | tick marks, chevrons, table "+" and grips (e.g. lines 220, 226, 353, 379, 387, 1292, 1570, 1572) | ~25 declarations |
| Literal 13–22 px | inline `style=` and a few rules (16 px ×4, 14 px ×2, 13/15/17/20/22 px ×1 each) | ~11 |
| Literal 30/36 px | empty-state icons | 3 |
| Weights | 400 ×2, 500 ×21, 600 ×38, 700 ×22 | 83 |
| Families | `--font` (system stack), `--mono` | 2 |

### Radius
| Variant | Uses |
|---|---|
| `--radius` (10) 33, `--r-xs` (4) 29, `--r-s` (8) 21, `--r-m` (10) 9, `--r-l` (12) 4, `--glass-r-menu` 2, `--radius-lg`/`--glass-r-row`/`--glass-r-bar` 1 each | 101 |
| `999px` pills | 29 |
| Literals 1–3 px (scroll thumbs, table handles) | 8 |
| Literal 6 px | 1 |

`--radius` and `--r-m` are the same value (10) under two names, 42 uses combined.

### Colours
| Variant | Where | Count |
|---|---|---|
| Hex outside token definitions | `theme-color` meta (2), print CSS (1), mail/copy export HTML (~18), focus-ring comment text | 24 lines, all documented as deliberate |
| Surface tokens | `--bg`, `--bg-2`, `--bg-3`, `--glass-strong`, defined twice for the normal and the reduced-transparency path (lines 956–961) | – |
| Accent / selection | `--accent`, `--sel-*`, `--sel-inactive` | – |

### Dialogs and modal types
| Type | Instances |
|---|---|
| `role="dialog"` | 14 |
| `role="alertdialog"` | 1 (confirm) |
| Shells | plain `.modal` (folder, project, import, new file, data-file chooser), `.sync-modal` (link file, AI apps), settings-style (Help, Shortcuts, About), custom sheets (Global Variables, Compare) |
| Non-modal popovers | cell popovers, `#rowMenu`, tool menus, link popover, `/` menu |
| Button rows | `.modal-actions`, right-aligned, Cancel then primary (lines 2283–2691) |

### Context menus
19 `oncontextmenu` sites: task row (list and board), project row, task-trash row, notes folder, note row, note body (links), prompt folder, prompt row, prompt items (option, preset, variable), table (grips, whole table). None for: subtask/step/sub-step rows, tags, board column headers, the sidebar's smart views.

### Icons
One registry (`ICONS` / `MENU_SVG`, outline, 24 grid, stroke 2) drawn as masks for `.fa-NAME`, plus inline `.tb-ico2` SVGs; drawn sizes 12/14/16/18. No second icon set.

### Feedback
| Type | Where |
|---|---|
| Toast (live region, Undo, 2.4 s / 6 s with Undo, held on hover/focus) | `showToast` line 10598, `armToastTimer` 10612 |
| Banners | `#syncBanner`, `#updateBanner` (lines 11003–11004, 11172) |
| Inline messages | Compare `#pdfMsg`, link popover hint, file-name validation |
| Confirm dialog | permanent delete, delete all, unlink |

### Motion
Transition durations in use: .08, .1, .12, .15, .2, .25, .35 s (7 values); easings: `ease`, `ease-out`, one spring `cubic-bezier(.34,1.56,.64,1)`; `checkPop` 0.2 s. Reduced-motion/transparency/contrast media queries: 3.

### Hover / state vocabulary
Row hover: `--bg-2` fill; selected row: solid accent (grey when focus is elsewhere); pills: brightness + halo; board tile: shadow lift; hidden controls: opacity reveal; toolbar capsules: `--cap-hover`; cursor: arrow on controls, hand on 3 link rules.

### Tooltips
169 `title="…"` attributes (native browser tooltips), 177 `aria-label`s. No custom tooltip component.

### Empty / loading / error states
Empty states exist in all three modes (icon + title-style label). No loading states needed (local data); the only waiting state is the file-link flow. Errors are toasts with `role="alert"`.

---

## 5. Findings

Severity: High = breaks expectation/usability/accessibility; Medium = visible inconsistency; Low = polish. HIG base URL: `https://developer.apple.com/design/human-interface-guidelines/`.

| ID | Category | Finding | Type | Locations | HIG reference | Sev. | Effort | Root | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| U-01 | Modals / destructive | A destructive confirm moves focus to **Cancel** so Return cancels (`dflt = danger ? confirmModalCancel : confirmModalBtn`). The HIG says never make Cancel the default; to stop reflexive Return, make **no** button default. | HIG deviation | line 5642; buttons 2284–2285; `CLAUDE.md` "Dialogs" | `alerts` ("Note that you don't want to make a Cancel button the default button") | Low | S | R3 | Focus neither button (or the dialog) for destructive confirms; keep Esc = Cancel. |
| U-02 | Modal button placement | Import dialog row is *Cancel · Merge · Replace*: the trailing/default slot holds the destructive *Replace* (red). The less risky *Merge* sits in the middle. | Both | lines 2322–2324 | `alerts` (default button trailing; destructive style marks an unintended destructive action; keep a safe choice) | Medium | S | R2 | Order *Cancel · Replace · Merge* (Merge trailing and default), or make Replace a text-style danger and move it left. |
| U-03 *(fixed: AI Apps now Cancel · Save; rule recorded)* | Modal button wording | Same role, different words: *Save* (folder, project), *Create* (new file), *Done* (AI apps, Global Variables, About-style), *Merge/Replace* (import). *Done* alone with no Cancel in Global Variables and the data-file chooser has only *Cancel*. | Both | lines 2274, 2297–2298, 2310–2311, 2571, 2638, 2679, 2691 | `sheets` (Done pairs with Cancel; Cancel dismisses without saving) | Low | S | R2 | Rule: dialogs that edit a draft use *Cancel + Save/Create*; dialogs whose changes apply live use *Done* only; say so in a comment next to each. |
| U-04 | Context menus | Unavailable commands are **dimmed**, not hidden (locked folder/project/note/prompt, table Header toggles, Move up/down). | HIG deviation (decided exception) | `rowMenuItem` `o.off`, line 4033; `CLAUDE.md` "Menus dim, not hide" | `context-menus` ("Hide unavailable menu items, don't dim them" – except Cut/Copy/Paste) | Medium | S | R3 | Hide, or keep dimmed only where the dimmed row teaches something (add a reason such as "Unlock first", already done for notes) and record it as an accepted deviation. |
| U-05 | Context menus | Keyboard shortcut hints appear in context menus (⌫ for Delete, ⇧⌘↵ in Open-in menu). The HIG puts shortcuts in the menu bar only. A web app has no menu bar, so the hints are the only on-screen reminder. | HIG deviation (justified) | `rowMenuItem` `o.hint`, line 4033; line 8178 | `context-menus` ("Show keyboard shortcuts in your app's main menus, not in context menus") | Low | S | R3 | Keep, but treat the Shortcuts dialog as the "menu bar" and make hints identical to it (one source). |
| U-06 | Context menus | Coverage is uneven: subtask/step/sub-step rows (list, board, panel), sidebar tags, board column headers and the smart views have none, while projects, folders, notes, prompts and table parts do. | Inconsistency + HIG deviation | `oncontextmenu` sites listed in section 4 (none on `task-subtask-row`) | `context-menus` ("Support context menus consistently throughout your app") | Medium | M | R4 | Add a subtask menu (Open Details, Add Step, Promote/Demote, Duplicate, Delete) and a tag menu (Rename/Colour/Delete) built from `rowMenuItem`. |
| U-07 *(decided: no change, keep the task row menu as it is)* | Context menus | The task row menu is long (Open, Rename, Priority ▸, Status ▸, Due ▸, Repeat ▸, Move to ▸, Duplicate, Delete …) with four submenus. The HIG asks for few items and one submenu level; levels are one deep but the count is high. | HIG deviation (mild) | `openRowMenu`; `CLAUDE.md` "Cell popovers" | `context-menus` ("small number of items") | Low | M | R4 | Needs visual check; consider moving rare items (Repeat) to the panel only. |
| U-08 *(decided: keep four stops; browser zoom covers 200%)* | Typography / accessibility | Text size offers 90/100/115/130 % (`UI_SCALE_STEPS`). The HIG asks for the ability to enlarge text by at least 200 %. Browser zoom works but is not an in-app setting. | HIG deviation | line 2889 | `accessibility` (Vision: "enlarge text by at least 200 percent"), `typography` | Medium | M | R5 | Add 150 % and 200 % steps (check the 52 px bars and 260 px sidebar minimum); note browser zoom as the alternative. |
| U-09 | Typography | About 30 literal `font-size` declarations remain beside the 7-step token scale (glyph marks 6–10 px, plus 13/14/15/16/17/20/22 px in a few rules and inline styles). | Inconsistency | lines 220, 226, 353, 374, 379, 387, 461, 703, 985, 1110, 1737 and inline styles | `typography` (macOS default 13 pt, minimum 10 pt) | Low | M | R1 | Add `--fs-glyph-*` tokens for control marks; replace the 13–22 px text literals with `--fs-*`. |
| U-10 | Typography | Control glyphs at 6–9 px (table "+" 6 px, grip 8–9 px, tick marks 7–8 px) are under the 10 pt macOS minimum. They are icons, not text. | HIG deviation (mild) | lines 1292, 1570, 1572, 379, 387 | `typography`, `accessibility` | Low | S | R1 | Needs visual check; raise to ≥10 px where the control allows. |
| U-11 | Accessibility / hit areas | Table grips are 14 px and the edge "+" 12 px; the macOS minimum control size is 20 × 20 pt. `CLAUDE.md` says an invisible `::before` enlarges remove buttons and table grips, but it is not confirmed for `.tbl-plus` in the code. | HIG deviation | lines 1292, 1570–1572 | `accessibility` (Mobility: macOS minimum 20 × 20 pt) | Medium | S | R6 | Needs visual check; add the same `::before` to `.tbl-plus` and `.tbl-grip.tbl` and test with the DevTools box model. |
| U-12 | Motion | Seven transition durations (.08–.35 s) and a spring easing with overshoot (`cubic-bezier(.34,1.56,.64,1)`) are mixed. Reduced-motion collapses all of it, which is correct, but normal-motion timing varies for the same kind of change (hover .1/.12/.15 s). | Inconsistency | `transition:` inventory, section 4 | `accessibility` (tighten springs, avoid bounce) | Low | M | R6 | Table: hover 120 ms ease, panel/menu open 200 ms ease-out, no overshoot. |
| U-13 | Spacing | Off-scale values remain against the documented scale (2,4,6,8,10,12,14,16,20…): 3 px ×11, 5 px ×8, 7 px ×5, 18 px ×6, 21 px ×4, 22 px ×5, 9 px ×3 in padding/gap/margin; the inline-style note in `CLAUDE.md` says inline styles were never remapped. | Inconsistency | `grep` of padding/gap/margin | `layout` (not re-fetched) | Low | M | R1 | Introduce `--sp-*` tokens and snap; add a test that scans for literals. |
| U-14 *(fixed: aliases removed)* | Colour / tokens | `--radius` and `--r-m` are two names for 10 px; `--radius-lg` and `--r-xl`/`--glass-r-menu` for 16 px. Both names are in use. | Inconsistency | radius inventory | – | Low | S | R1 | Keep one name per value and alias the other. |
| U-15 *(fixed: errors stay until dismissed)* | Toast / time limits | Toast hides after 2.4 s (6 s with Undo) unless pointer or focus is on it. The HIG warns about time-boxed UI. Errors (`role="alert"`) use the same timer; not confirmed whether they are held longer. | HIG deviation (mitigated) | lines 10598–10620 | `accessibility` (Cognitive: "Minimize use of time-boxed interface elements") | Low | S | R6 | Needs visual check; keep error toasts until dismissed. |
| U-16 | Tooltips | Tooltips are native `title` attributes (169): delay and style are the browser's, and keyboard users never see them. 177 `aria-label`s exist, but parity (every icon-only button has both) was not verified. | Both | `title=` / `aria-label` counts | `accessibility` (Vision/Mobility: labels) | Low | M | R6 | Needs visual check; test that each `button:not(:has(span))` has an `aria-label`. |
| U-17 *(not needed: the sidebar row is already neutral)* | Window / sidebar state | The sidebar's own active row does not turn grey when focus is in the list, panel or editor, unlike task, note and prompt rows. | Inconsistency | `CLAUDE.md` "Not done: the sidebar's own active row" | `lists-and-tables` (not re-fetched) | Low | S | R4 | Add the sidebar to the `sel-inactive` rule set. |
| U-18 *(fixed: underline for keyboard only)* | Focus | The task panel's title field shows a focus underline (`box-shadow 0 2px 0 var(--focus-ring)`) while its other fields (Notes, number fields) show only a caret with the mouse. | Inconsistency | `CLAUDE.md` "One focus style"; drawer title rule | `text-fields` (not re-fetched) | Low | S | – | Drop the underline for mouse focus; keep it under `html.kbd-input`. |
| U-19 | Modals | Fifteen dialogs open through `closeAllModals()`-style single-sheet logic, but nested flows had to be worked around: the Compare view uses an **inline** confirm because `openConfirmModal` would close every dialog. | Inconsistency | `CLAUDE.md` "Compare prompts"; `pdf.confirming` | `sheets` ("Display only one sheet at a time") | Low | M | R2 | Allow a stacked alert over a sheet, or standardise on inline confirms for sheets. |
| U-20 | Menu bar | There is no menu bar (web app), so File/Edit/View commands and their shortcuts are only reachable from the sidebar's Data/Appearance/Help menus and the Shortcuts dialog. | HIG deviation (platform limit) | whole app | `the-menu-bar` | Low | L | R5 | Accept; keep the Shortcuts dialog as the full command list. If packaged (Electron/Tauri), add the standard menus. |
| U-21 *(decided: keep Pin for Notes and Favorite for Prompts)* | Wording | Same concept, different word per mode: **Pin** (Notes) vs **Favorite** (Prompts) for "keep at the top"; **Recently Deleted** in all three but the verb is *Delete* vs *Remove* in panels. Prompts uses *Variables*, *Placeholders* and *Choices* in places for the same thing. | Inconsistency | Notes/Prompts menus and Help rows | `alerts` (labels; not re-fetched menus page) | Low | S | R7 | Pick one term per concept (glossary, section 6). |
| U-22 *(fixed: smart views have a menu)* | Navigation | Tasks has smart views (My Day, This Week, Overdue) in the sidebar but only projects have a context menu; Notes/Prompts folders have one. | Inconsistency | `openProjectMenu` (line 3375) | `context-menus` | Low | S | R4 | Give smart views a short menu (e.g. *Show in Board*), or none by rule. |
| U-23 | Dialogs | Three dialog shells (plain, settings-style, link/AI) use different header treatments (round blue icon vs plain 17 px title vs large title). | Inconsistency | `.modal`, `.sync-modal`, Help/Shortcuts | `sheets` | Low | M | R2 | Needs visual check; define two shells (form sheet, settings sheet) and map each dialog. |
| U-24 | Localisation | UI strings are hard-coded English in the script; dates and weekdays use `toLocaleDateString` (good), pluralisation is hand-written. | HIG deviation (if a second language is planned) | whole script | – | Low | L | R5 | Needs a product decision; if localised, move strings to one table and use `Intl.PluralRules`. |
| U-25 *(fixed: footer says "Saved as you type")* | Compare / Globals | Global Variables dialog applies every change live and is closed by *Done* only; the Compare view saves only on *Save*. Two different "when does it persist" models for similar sheets. | Inconsistency | `#globalsModalBg`, `#pdfModalBg` | `sheets` | Low | S | R2 | Say in the footer which model applies (Compare already shows unsaved state). |
| U-26 | Contrast (inactive selection) | Grey selected rows use `rgba(60,60,67,.18)` (light) / `rgba(255,255,255,.22)` (dark) with the normal text colours. Contrast on that fill is not computed in code. | – | `--sel-inactive` | `accessibility` (4.5:1) | Low | S | – | Needs visual check (section 7). |
| U-27 *(decided: keep Compare as a modal sheet)* | Modals | The Compare view is a large modal sheet used for repeated editing (typing, merging hunks, F7 navigation) with continuous observation of the result. The HIG: use a panel/window if people repeatedly provide input and observe results. | HIG deviation | `#pdfModalBg`, `openPromptDiff` | `sheets` ("Use a panel instead of a sheet if people need to repeatedly provide input and observe results"; also "open a new window … for self-contained tasks") | Medium | L | R2 | Open Compare in its own window/route (or a full-pane view like Notes), so other prompts stay reachable. |
| U-28 *(fixed: explicit not-allowed feedback)* | Drag and drop | Sub-steps drag only within their parent while steps/subtasks drag across parents, with different state variables; drop feedback is an accent line in the panel and list. Behaviour is documented but not discoverable. | Inconsistency | `draggedItem`, `draggedSubstep` | `drag-and-drop` (not re-fetched) | Low | M | – | Needs visual check; show a "not allowed" cursor when a sub-step is dragged outside its parent. |
| U-29 *(already the rule: red fill only in confirmations; recorded)* | Buttons | Button styles in dialogs: `btn`, `btn-primary`, `btn-danger`, `btn-text-danger` (panel Delete), `btn-sm`. A destructive action is a filled red button in one dialog and plain red text in the panel. | Inconsistency | lines 2285, 2324, 4347 | `buttons` (not re-fetched) | Low | S | R2 | Rule: filled red only inside confirmation dialogs; plain red text elsewhere. |

---

## 6. Proposed consistency rules

| Category | Rule |
|---|---|
| Components / tokens | No literal colour, radius, font size or spacing in rules or inline styles; use `--*` tokens. A test lists any new literal. |
| Surfaces | Chrome is glass (sidebar, menus, modals); content is flat and opaque. |
| Modals | Edit-a-draft dialogs: *Cancel* leading, one primary (*Save* / *Create*) trailing and default. Live-apply dialogs: *Done* only. A repeat-edit task gets a window or pane, not a sheet. |
| Modal buttons | Destructive filled red only in confirmation dialogs; it is never the default and never the only trailing button when a safe option exists. Destructive confirms put focus on no button. |
| Context menus | Every object you can select and act on has a menu built from `rowMenuItem` / `rowMenuSub`: Open/Edit, status-like submenus, Duplicate, then Delete last in red; at most one submenu level; unavailable items hidden (or dimmed with a stated reason). |
| Controls | Primary action at the trailing end of its bar; icon-only buttons have an `aria-label` and a `title`. |
| Navigation | The current location is the solid accent row, grey when focus is elsewhere – in the sidebar too. |
| Forms | One look for fields (ghost/inline in lists, grouped rows in the panel, boxed in dialogs); validation on submit with one inline message line. |
| Lists / tables | Truncate with ellipsis and show the full text as `title`. Row selection is the accent fill. |
| Empty / error states | Icon + title-style label; errors as toasts with `role="alert"` that stay until dismissed. |
| Feedback | Undoable → toast with Undo; not undoable → alert dialog. |
| Typography | Text uses `--fs-11…22`, weights 400/500/600/700; control glyphs use `--fs-glyph-*`. |
| Icons | Only the `ICONS` registry; sizes 12/14/16/18; one icon per meaning (see `CLAUDE.md`). |
| Hover / state | Hover is a fill (rows, capsules), a brightness change (pills) or a lift (tiles) – never a colour swap alone. |
| Spacing / shape | Spacing from the 2…40 scale; radii from `--r-*`; one name per radius value. |
| Motion | Hover 120 ms ease, open/close 200 ms ease-out, no overshoot; everything collapses under Reduce Motion. |
| Keyboard | Return = default action, Escape = cancel/close, Tab wraps inside dialogs; shortcuts come from one table. |
| Accessibility | Controls ≥20 × 20 pt hit area (invisible `::before` allowed); text contrast ≥4.5:1 in both themes and on grey selection. |
| Wording | Title-style capitalisation for menu items and buttons; one term per concept: **Pin** (notes only), **Favorite** (prompts only) unless merged; **Duplicate** everywhere; **Recently Deleted**. |

---

## 7. Needs visual check

- Computed contrast of text and pills on the grey inactive selection (U-26), and of `--text-3` on every surface in both themes.
- Rendered size and hit area of `.tbl-plus` / `.tbl-grip` with their `::before` (U-10, U-11).
- Whether error toasts disappear on the same timer as success toasts (U-15).
- Parity of `title` and `aria-label` on every icon-only button (U-16).
- Height and scan-ability of the task row menu (U-07).
- Header and spacing parity of the three dialog shells (U-23).
- Escape / click-outside dismissal behaviour in all 15 dialogs (code shows per-dialog `onkeydown` on some; the global path was not traced).
- Focus order and screen-reader reading order of the panel, Compare view and Variables panel.
- Not done in this audit: any run in Safari, or at 1100/860 px, after the earlier narrow-window fixes.

---

## 8. Skipped categories

| Category | Reason |
|---|---|
| Forms and validation (required markers, validation timing) | Only two real forms (folder/project name, new file name); validation is inline and on submit; nothing to compare. |
| Loading indicators | All data is local; no spinner/skeleton/progress is needed. |
| Menu bar | Not available in a web app (see U-20); standard menus cannot be provided. |
| Window management (full screen, multi-window) | Browser/PWA window; the app has one window. |
| Pointer devices beyond mouse/trackpad | The `pointing-devices` page was not fetched; touch behaviour only noted via `pointer: coarse` rules. |
