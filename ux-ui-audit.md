# MyDesk – UX/UI audit (consistency + Apple HIG)

Audit date: 2026-10-20. Read-only: no code was changed. Scope: `mydesk.html` (single file, 9,630 lines) in its three modes, **Tasks, Notes and Prompts**, plus the dialogs, menus and the new Global Variables dialog.

This report **replaces** the earlier audit (F-01 … F-38, closed out in commit `cc1ec62`; recover it with `git show cc1ec62:ux-ui-audit.md`). Findings here use the prefix **A-**. Items the earlier audit already decided to keep are listed again only where they are still HIG deviations (A-22, A-23, A-24).

**How the evidence was gathered**
- HIG pages were fetched as Markdown from `developer.apple.com/design/human-interface-guidelines/<page>.md`: sheets, toolbars, context-menus, menus, alerts, modality, buttons, typography, accessibility, color, dark-mode, lists-and-tables, text-fields, sidebars, motion, keyboards, feedback, undo-and-redo, sf-symbols and the-menu-bar. The `inspectors` page returned 404; guidance on inspectors is taken from *toolbars* ("buttons that open nearby inspectors" sit on the trailing edge). Pages fetched later (2026-10-20): layout, popovers, windows, drag-and-drop and icons (findings A-35 to A-41). Pages still **not** fetched: materials, pointing-devices, offering-help; no finding relies on them.
- Code was read and counted (sizes, radii, colours, handlers). Line numbers refer to the current `mydesk.html`.
- Headless-Chrome screenshots of Prompts mode at 1500, 1100 and 860 px wide confirmed A-01, A-02, A-03, A-04 and A-06, and the Global Variables dialog was checked after the last alignment fix.
- Anything that needs a real device, a screen reader or a light-theme run is marked **needs visual check** (section 7).

---

## 1. Summary

**Platform and stack.** An installable web app (PWA) used mainly in macOS desktop browsers, so the macOS HIG applies. Plain HTML/CSS/vanilla JS in one file, no framework, no build step. One visual scheme ("Glass", light and dark). System font stack, one inline-SVG icon registry (`ICONS`, drawn at 12/14/16/18 px). Design tokens for colour, type, radius, spacing and icon size are in place. A test suite (`tests/`, 314 tests) and `CLAUDE.md` document the rest.

**Overall assessment.** The token work from the last audit holds: only 6 colour literals remain outside token definitions, there are 7 type steps and a 5-step radius ladder, one icon family, one focus style, one close path for 12 dialogs, and reduced-motion is respected. What is left falls into two groups. (1) **Prompts, the newest mode, does not yet adapt to narrow windows**, and its toolbar is the busiest in the app. (2) **The three modes grew at different times**, so the same job has different words and different safety nets (Duplicate/Clone, Pin/Favorite, a Delete that asks first in Tasks but not in Notes or Prompts).

**The 5 most important issues**
1. **A-01 – Prompts layout breaks in narrower windows.** With the Variables panel open at 1100 px the template column is about 140 px wide and words break mid-word; at 860 px the panel runs past the window edge. (High)
2. **A-07 / A-09 – Delete is inconsistent.** Six dialogs ask for confirmation while saying "You can undo this from the toast", which the HIG advises against; Notes and Prompts delete without asking, and Tasks, Notes and Prompts disagree on whether a deleted item can be recovered. (Medium)
3. **A-02 – The Prompts toolbar wraps onto two or three rows** instead of shrinking or overflowing; Notes has container queries for this, Prompts does not. (Medium)
4. **A-31 / A-32 – Feedback is not accessible enough:** the toast has no live region, and it disappears after 2.4 s (6 s with Undo) even while the pointer or focus is on it. (Medium)
5. **A-33 – Hover-only remove buttons (18 px) and table grips (12–14 px) are under the macOS 20 × 20 pt minimum.** (Medium)

---

## 2. Root causes

| ID | Root cause | Related findings | Recommended fix | Effort |
|---|---|---|---|---|
| RC1 | The three-pane layout (sidebar 300 + list 300 + inspector 340) has no priority order for narrowing; only Notes has container queries | 3 (A-01, A-02, A-40) | Give Prompts a collapse order: the inspector becomes an overlay below about 1100 px, then the list narrows, then the sidebar collapses; set a minimum editor width; add the container queries Notes has | M |
| RC2 | The Prompts toolbar was built by adding controls to the Notes bar rather than against the HIG toolbar anatomy | 4 (A-03 – A-06) | At most three groups (leading: new, undo/redo; centre: insert; trailing: ⋯, Copy, inspector); move Favorite and Lock into ⋯ or one capsule; drop the ring borders; dim undo/redo as Notes does | M |
| RC3 | Deletion, undo and confirmation were designed per mode | 3 (A-07 – A-09) | One rule: recoverable deletes (anything with Undo or Recently Deleted) never ask; only permanent, un-undoable deletes get an alert | M |
| RC4 | One menu component (`rowMenuItem`, line 3623) serves both pull-down menus and right-click menus, which the HIG treats differently | 3 (A-10 – A-12) | Add a `context` option that hides instead of dims and omits shortcut hints; keep dimming in ⋯ menus | S |
| RC5 | Vocabulary drifted between modes built at different times | 2 (A-13, A-14) | Pick one word per concept (Duplicate; Pin or Favorite) and rename in menus, Help and the shortcut sheet | S |
| RC6 | Features add their own small components without a catalogue (quiet-add controls, popovers, empty states, dialog footers) | 9 (A-15 – A-20, A-38, A-41, A-42) | Add a short component list to CLAUDE.md (one add control, one empty state, one popover base) and migrate when a screen is next touched | M–L |
| RC7 | Web-platform limits and earlier "keep" decisions | 7 (A-21 – A-26, A-39) | Document as accepted; revisit A-21 (text size) first | – |
| RC8 | No tokens for motion, and no rule against one-off sizes and inline styles | 4 (A-27 – A-30) | Add `--dur-fast/base/slow` and an easing token; replace the one-off `calc()` sizes; move inline `style=` into classes when a template is touched | M |
| RC9 | Transient and hover-only UI was not checked against accessibility guidance | 3 (A-31 – A-33) | `role="status"` and `aria-live`; pause the toast timer on hover/focus; enlarge hit areas with a `::before` | S |
| RC10 | Shortcuts were chosen to avoid browser conflicts, not HIG semantics | 1 (A-34) | Choose from keys the HIG leaves free; keep one meaning per key across modes | S |
| RC11 | Icons were picked per feature without checking Apple's standard set or reusing one drawing for one concept | 3 (A-35 – A-37) | Keep a short icon list in CLAUDE.md (Duplicate, Copy, Filter, mode icons) and swap the three outliers | S |

---

## 3. Quick wins (High or Medium, effort S)

| ID | Finding | Fix |
|---|---|---|
| A-07 | Six undoable deletes ask for confirmation and also show Undo | Remove the confirmation for task, project, folder and global-variable deletes; keep the Undo toast; keep alerts only for permanent deletes **Fixed 2026-10-20.** |
| A-13 | "Duplicate" in Tasks, "Clone" in Notes and Prompts | Rename Clone to Duplicate (menus, Help, tests, toast) **Fixed 2026-10-20.** |
| A-31 | The toast is not announced to screen readers | Add `role="status" aria-live="polite"` to `#toast` (errors: `role="alert"`) **Fixed 2026-10-20.** |
| A-32 | Toast timeout ignores hover and focus | Pause `toastHideTimer` on hover and focus-within; keep 6 s for Undo **Fixed 2026-10-20.** |
| A-33 | 18 px remove badges and 12–14 px table grips | Add a `::before` that grows the hit area to at least 20 × 20 (already done for checkboxes) **Fixed 2026-10-20.** |

---

## 4. Inventory

Counts come from the current file. "Tokens" are CSS custom properties.

### Component duplication and design-system drift
| Variant | Where | Count |
|---|---|---|
| Push buttons `.btn` (radius 10 px, 0.5 px border, 6 × 14 padding) | dialogs, bars | many |
| Toolbar capsule buttons `.tool-btn` (pill, 32 × 28) | task, note and prompt bars | many |
| Round toolbar buttons `.note-more-btn`, `.note-new-btn`, `.note-lock-btn` (circle with ring) | Notes and Prompts bars | 3 to 5 per bar |
| Pills and chips `.pr-chip`, `.pr-pill`, `.f-chip`, `.badge` | Prompts panel, filters, tasks | 4 styles |
| Square +/− bar buttons `.pr-g-bar-btn` | Global Variables dialog | 4 |
| Quiet add controls: `.pr-add-item`, `.pr-chip.add`, `.pr-pill.add`, `.pr-g-link`, sidebar "+" | Prompts, sidebar | 5 |
| Popover and menu surfaces: `#rowMenu`, `.cell-pop`, `.split-btn-menu` (help, filter, tool, colour), `.qa-popup`, `#noteLinkPop` | 1698, 1838, 1866, 1900, 1945, 5133–5143 | 6 |
| Inline `style="…"` attributes | markup and JS templates | 93 (12 set a font size) |
| Colour literals outside token definitions | CSS | 6 (print rules, 3 `--cap-*` fallbacks, a comment) |

### Background colours and surfaces
Tokens `--bg`, `--bg-2`, `--bg-3`, glass variants for chrome, opaque neutral values scoped on `.main` and `.drawer`, `--wall` behind the sidebar. Light and dark define the same variables. No raw hex backgrounds except print. Accent: `--accent` with `--accent-hover` and `--accent-tint`. Tints: blue, teal, amber, purple and red as `-bg`/`-text` pairs.

### Modals (12 dialogs, all `role="dialog"` or `alertdialog`)
Global Variables (2053), Confirm (alertdialog), Folder, Project, Import, Help, About, Projects shown (2345), Shortcuts, File sync, New file, Data files. Footers: Cancel + primary (Folder, Project, Import, New file, Confirm); Done only (Global Variables, Projects shown); Cancel only (Data files); none (Help, About, Shortcuts). One close path (`closeModal`); Esc and a click on the backdrop close all of them.

### Context menus (right-click)
Task row and card, project row (Tasks), note row, note folder, note body (links, table grips, whole table), prompt row, prompt folder, prompt option, preset and checklist item (3 kinds). No right-click on: Global Variables rows and values, sidebar tags (none found in code), the prompt template (the browser's own menu).

### Placement of controls
Every pane has a 52 px bar. Tasks: title and selection capsule. Notes: new, style, undo/redo, B I U S, blocks, spacer, lock, ⋯. Prompts: new, undo/redo, insert ×4, spacer, favorite, lock, ⋯, Copy Prompt, inspector toggle. The primary button (Copy Prompt) is on the trailing side and the inspector toggle is last.

### Navigation
Sidebar mode switch (Tasks | Notes | Prompts), sidebar lists, collapsible sidebar (⌥⌘S), selection is a solid accent row everywhere.

### Forms and validation
Single-line fields in dialogs (folder name, project name, file name, variable name, link) and inline renames. Duplicate names are refused with a toast (Prompts options, presets and global names).

### Lists and tables
Task list (sortable headers, solid-accent selection), notes list, prompts list (same `.note-row`), sidebar rows. Truncation: `text-overflow: ellipsis` plus a tooltip (`tipIfTruncated`, `title` on pills).

### Empty, loading and error states
Empty-state variants: `.empty-state`, `.board-empty`, `.notes-empty`, `.notes-list-empty`, `.pr-empty-actions`, `.pr-insp-empty`, `.pr-g-detail-empty`, `.pr-g-empty-list`, `.task-cell-empty` (9). Loading indicators: none (all data is local). Errors: a toast with a warning icon, or an inline red hint (link popover).

### Feedback and notifications
Toast (one element, 90 call sites, 24 with Undo, 2.4 s or 6 s), sync banner (dismissable, per session), inline hints, 12 dialogs of which one is an `alertdialog`; 12 `openConfirmModal` calls.

### Destructive actions and undo
Confirm and Undo: delete task(s) (3815, 4313), project (4761), note folder (6392), prompt folder (7143), global variable (8596). Confirm only (permanent): delete a note or prompt permanently, delete all (6266, 6301, 7063, 7087), unlink file (9507). Undo toast only: notes and prompts moved to Recently Deleted, preset delete.

### Typography
Text sizes: `--fs-11` ×26, `--fs-12` ×55, `--fs-13` ×55, `--fs-14` ×32, `--fs-15` ×15, `--fs-17` ×8, `--fs-22` ×7. One-offs: `calc(var(--fs-13) * .96)` (1574), `* .88`, `.88em`, `.92em`; glyph sizes of 6–10 px (218, 224, 356, 377, 382, 390, 464, 992, 1117, 1209, 1502). Weights: 500 ×21, 600 ×34, 700 ×14 (400 is the default). One sans family (`--font`) and `--mono` for code and templates.

### Icons
One source: the `ICONS` registry (outline SVG, 24 grid, stroke 2, `currentColor`), drawn as masks (`.fa-NAME`) and inline (`svg.mi` 16, `.tb-ico2` 18). Sizes 12/14/16/18 via `--ico-*`. No icon font, no emoji. Filled variants are not used (selection is expressed by colour).

### Hover and interaction states
105 hover rules: background 64, colour 39, opacity 23, box-shadow 16, border-colour 8, filter 4. One focus ring (`--focus-ring`). Cursor: `default` ×60, `pointer` ×2 (links), `col-resize` ×7, `text` ×4, `grab` ×1.

### Tooltips
161 `title` attributes (native tooltips, no custom delay) and 110 `aria-label`s.

### Spacing and layout
Single-value padding rules use 2, 4, 6, 8, 12, 16 and 24 px (a defined scale); `--gutter` is 20 px. Widths: sidebar 300 (200–480), notes and prompts list 300 (200–600), inspector 340 fixed, note column at most 900.

### Shapes and depth
Radii: `--r-xs` 4 (×28), `--r-s` 8 (×18), `--r-m`/`--radius` 10 (×34 + 6), `--r-l` 12, `--r-xl` 16, 999px ×25, 50% ×19. Elevation tokens `--elev-1/2/3`. Hairlines 0.5–1 px in `--border`.

### Motion
Transition durations: .08 s, .1 s ×6, .12 s ×8, .15 s ×8, .18 s ×2, .2 s ×8, .24 s, .25 s, .35 s ×2 (9 values). One `prefers-reduced-motion: reduce` block collapses all of them.

### Drag and drop
Tasks reorder, subtasks and steps reorder, notes and prompts drag onto folders (`.drop-into` highlight, Undo toast), folders reorder. The same highlight class serves both folder lists.

### Keyboard
Return and Esc in dialogs, ↑↓ in lists, F2 rename, Delete, ⌘↵ Copy Prompt, ⌥⌘I inspector, ⌥⌘S sidebar, ⌃⌘C Copy Note, ⌘K link, the shortcut sheet on **?**.

### Accessibility
Dialog roles and names on all 12 dialogs; custom checkboxes with `role="checkbox"`; reduced-motion; secondary text calculated at 4.5:1 or better in the last audit. No live region on the toast.

### Wording
Menu labels are title-style; an ellipsis marks commands that need input ("Edit Values…", "Create it…", "Save as Preset…"). Terms that differ by mode: Duplicate / Clone, Pin / Favorite.

---

## 5. Findings

Type: **I** inconsistency, **H** HIG deviation, **B** both. HIG pages are under `https://developer.apple.com/design/human-interface-guidelines/`. Effort S / M / L as defined in the brief.

| ID | Category | Finding | Type | Locations | HIG reference | Severity | Effort | RC | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| A-01 | Window / layout | Prompts has no narrowing order. Sidebar (300) + list (300) + inspector (340, fixed) leave the editor about 140 px at a 1100 px window (the template wraps mid-word, the title is cut to "Create is"); at 860 px the Variables panel runs past the window edge. The inspector only auto-opens at 1300 px or wider on load, but it can be opened at any width. Notes does not have this problem. | B | `.pr-split` 1586, `.pr-inspector` 1588, `togglePromptInspector` 6988–6998; screenshots `n1100.png`, `n860.png` | `sidebars` ("automatically hiding and revealing a sidebar when its container window resizes"), `toolbars` | **High** | M | RC1 | Make the inspector an overlay on the editor's right edge below about 1100 px; set a minimum editor width (about 420 px); collapse in the order inspector, list width, sidebar **Fixed 2026-10-20.** |
| A-02 | Toolbars | At 1100 px the Prompts toolbar wraps onto a second row (⋯, Copy Prompt, inspector toggle); at 860 px it takes three rows and the `{{ }}` buttons stack their braces. Notes has container queries (1495–1498) that shrink its bar; Prompts has about twice the controls and no rule. | B | markup 1993–2012, CSS 1495–1498; `n1100.png`, `n860.png` | `toolbars` ("avoid layouts that cause toolbar items to overflow by default"; the system adds an overflow menu) | Medium | M | RC1 | Collapse the four insert buttons into one "Insert Variable" pop-up button below about 900 px; move Favorite and Lock into ⋯ at the same breakpoint **Fixed 2026-10-20.** |
| A-03 | Toolbars | The Prompts toolbar has eight separate controls in about six groups (new, undo/redo, insert ×4, favorite, lock, ⋯, Copy, inspector). | H | 1993–2012; `tb.png` | `toolbars` ("aim for a maximum of three" groups) | Low | M | RC2 | Leading: new and undo/redo. Centre: insert. Trailing: ⋯ (holding Favorite and Lock), Copy Prompt, inspector toggle |
| A-04 | Toolbars | Compose, ⋯, Favorite, Lock and the inspector toggle are circles with a ring; the HIG asks for symbols without borders because the bar already provides the container. The same ring is used in Notes, so it is consistent but not HIG. | H | `.note-new-btn` 1432, `.note-more-btn` and `.note-lock-btn` 1492 | `toolbars` ("Prefer system-provided symbols without borders") | Low | M | RC2 | Drop the ring and keep the hover fill; keep a fill only for a toggled state **Fixed 2026-10-20:** the round bar buttons keep the soft fill of the capsule groups but have no ring or rim. |
| A-05 | Toolbars | Notes dims Undo and Redo when there is nothing to undo (`disabled`, updated from `queryCommandEnabled`); in Prompts they are always active. | I | Notes 1935 and 8063; Prompts 1996–1997 and 7013 | `undo-and-redo` | Low | S | RC2 | Track the textarea's undo state and set `disabled` as Notes does |
| A-06 | Toolbars / colour | Favorite and Lock fill amber when on, next to a solid-blue Copy Prompt: three tinted controls in one bar. | H | `.note-more-btn.on` 1493; `tb.png` | `toolbars` ("Reduce the use of toolbar backgrounds and tinted controls"), `color` | Low | S | RC2 | Show the "on" state through the symbol (filled star, closed lock) on the neutral capsule; keep colour for the primary action |
| A-07 | Alerts / undo | Six deletes show a confirmation dialog **and** say "You can undo this from the toast". The HIG says not to alert for common, undoable actions. Notes and Prompts do not ask. | B | 3815, 4313, 4761, 6392, 7143, 8596 | `alerts` ("Avoid displaying alerts for common, undoable actions"), `feedback` | Medium | S | RC3 | Remove the confirmation for these; keep the 6 s Undo toast. Keep alerts only for permanent deletes (6266, 6301, 7063, 7087) and Unlink (9507) **Fixed 2026-10-20.** |
| A-08 | Alerts | A destructive confirmation focuses **Cancel**, so Return cancels. The HIG says not to make Cancel the default button; if nothing should be the default, give no button the default. The earlier audit (F-08) chose this on purpose. | H | `openConfirmModal` 5251–5258 | `alerts` ("you don't want to make a Cancel button the default button") | Low | S | RC3 | Either focus neither button, or accept the deviation and keep it documented |
| A-09 | Destructive actions | "Delete" means three things: in Tasks it asks, then removes with Undo; in Notes and Prompts it does not ask and moves the item to Recently Deleted for 30 days; "Delete Permanently" asks. People cannot predict whether a delete can be recovered. | I | Tasks 3647 and 3815; Notes 5966; Prompts 7173; the 30-day purge in `normalizeNotes` and `normalizePrompts` | `feedback`, `undo-and-redo` | Medium | M | RC3 | Either give Tasks a Recently Deleted list like the other modes, or drop its confirmation (A-07) and describe it consistently **Fixed 2026-10-20.** |
| A-10 | Context menus | Unavailable items are dimmed in right-click menus (18 `off:` uses, for example a locked note or prompt shows Delete dimmed with "Unlock First"). The HIG says menus dim, **context menus hide**. The same `rowMenuItem` renders both ⋯ menus and right-click menus. Earlier finding F-12 chose dimming everywhere. | H | `rowMenuItem` 3623, 5966, 7173 | `context-menus` ("Hide unavailable menu items, don't dim them"), `menus` | Low | S | RC4 | In right-click menus omit unavailable items; keep dimmed items in ⋯ pull-down menus |
| A-11 | Context menus | Keyboard shortcuts (⌫, F2 and others) are shown in right-click menus. The HIG puts them in the menu-bar menus; this web app has no menu bar, so the menu is the only place they are discoverable. | H | 3647, 5966, 7173 | `context-menus` ("Show keyboard shortcuts in your app's main menus, not in context menus") | Low | S | RC4 | Accept (no menu bar) and note it in CLAUDE.md, or show the shortcuts only in the shortcut sheet |
| A-12 | Menus | The "insert global variable" menu puts the same globe icon on every item. | H | `openPromptGlobalInsertMenu` around 8532 | `menus` (icons for every item in a group or none; none if no icon clearly represents the item) | Low | S | RC4 | Drop the per-item icons; keep the globe on the toolbar button only |
| A-13 | Wording | The same command is **Duplicate** in Tasks and **Clone** in Notes and Prompts (also the "Clone removed" toast and Help rows). Apple's standard word is Duplicate. | B | 3582 and 3646 against 5962, 7170 and Help 2260 | `menus`, `keyboards` (standard commands) | Medium | S | RC5 | Rename Clone to Duplicate everywhere, including Help, tests and the toast **Fixed 2026-10-20.** |
| A-14 | Wording | Notes use **Pin / Pinned** (thumbtack, floats to the top); Prompts use **Favorite / Favorites** (star, filter only). They are different features but fill the same slot and look alike. | I | Notes menu 5962 area ("Pin Note"); Prompts menu 7170 area ("Favorite") | `sf-symbols` (one symbol per action) | Low | S | RC5 | Keep both only if the difference is intended; otherwise use Pin in both |
| A-15 | Modals | Two dialogs offer only **Done** while applying changes live (Global Variables, Projects shown). The HIG says a Done button should be paired with Cancel or Back; a dialog that applies live is closer to "Close". | H | 2053, 2345 | `sheets` ("Provide an alternative to the Done button") | Low | S | RC6 | Label the button "Close", or make the dialog transactional with a Cancel |
| A-16 | Context menus | Right-click exists on every list item except inside the Global Variables dialog (rows and values rename only by double-click or F2) and on sidebar tags (none found in code). | I | dialog rows, `renderGlobalsModal` around 8560 | `context-menus` ("Support context menus consistently throughout your app") | Low | S | RC6 | Add Rename and Delete context menus to the dialog's rows and values; check the tags |
| A-17 | Colour | Purple is the Prompts colour for global variables, a tag colour (`CAT_COLORS`) and the bulk-selection tint in one rule. | I | `.task-row.kbd-selected.bulk-selected` 349; `.ph-glob` | `color` ("Avoid using the same color to mean different things") | Low | S | RC6 | Needs visual check; if the bulk tint is still reachable, move it to the accent |
| A-18 | Components | Five different "add something" controls: the `+ Save as Preset…` chip, the round `+` pill, the "Add item" link, the "Edit Values…" link and the sidebar "+". Each has its own padding, colour and hover. | I | `.pr-add-item`, `.pr-chip.add`, `.pr-pill.add`, `.pr-g-link` (1587–1620) | `buttons` | Low | M | RC6 | One quiet-add class with a text variant and an icon variant |
| A-19 | Components | Six popover and menu surfaces are implemented separately (`#rowMenu`, `.cell-pop`, `.split-btn-menu` ×4, `.qa-popup`, `#noteLinkPop`); they look aligned but placement, outside-click and focus code is repeated. | I | 1698, 1838, 1866, 1900, 1945, 5133 | `menus` | Medium | L | RC6 | Move placement and dismissal into one helper over time |
| A-20 | Empty states | Nine empty-state variants in three layouts (icon and text, plain text, text and actions). | I | `.empty-state`, `.board-empty`, `.notes-empty`, `.pr-insp-empty`, `.pr-g-detail-empty` and more | – (consistency; no specific HIG page) | Low | M | RC6 | One empty-state component with an optional icon and an optional action row; review the wording per screen |
| A-21 | Typography / accessibility | The text-size control stops at 130 %. The HIG asks that people can enlarge text by at least 200 %. Browser zoom works, so the platform meets the need, not the app. | H | `UI_SCALE_STEPS` 2552 | `accessibility` ("enlarge text by at least 200 percent") | Medium | M | RC7 | **Kept by decision (2026-10-20): not to be changed.** Was: add a 150 % and a 200 % step, or state in Help that browser zoom is the route |
| A-22 | Appearance | App-level Light, Dark and Match System. The HIG says to avoid an app-specific appearance setting; mitigated by "Match System" as the default (earlier F-18). | H | Appearance popover | `dark-mode` ("Avoid offering an app-specific appearance setting") | Low | – | RC7 | Accepted; keep Match System as the default |
| A-23 | Colour | The accent is a fixed blue; a browser cannot read the system accent colour reliably (earlier F-17). | H | `--accent` | `color` (app accent colours) | Low | – | RC7 | Accepted web limit |
| A-24 | Modality | Dialogs are centred cards, not window-attached sheets (earlier F-07). | H | `.modal` | `sheets` (macOS) | Low | – | RC7 | Accepted web limit |
| A-25 | Navigation | Sync status, Data, Appearance and Help sit at the bottom of the sidebar, and in Notes and Prompts so does Recently Deleted. | H | `.sb-tools`, `#trashNav` | `sidebars` ("Avoid putting critical information or actions at the bottom of a sidebar") | Low | S | RC7 | Needs visual check; in a browser tab the bottom edge is always visible, so probably acceptable |
| A-26 | Localization | All UI text is hard-coded English. Dates use `toLocale*` (2852, 4004, 6090–6093, 6173), but dialog and menu strings cannot be translated and +30 % string length was not tested. | H | whole file | – (localisation guidance not fetched) | Low | L | RC7 | By design for now; keep new strings in one place where possible |
| A-27 | Typography | One-off sizes bypass the scale: `calc(var(--fs-13) * .96)` for the template field, `* .88`, `.88em` and `.92em` for code chips, and glyph sizes of 6–10 px inside controls. macOS minimum text size is 10 pt; the smallest ones are icon glyphs, not text. | B | 1574 and the `.88`/`.92` rules; 218, 224, 356, 377, 382, 390, 464, 992, 1117, 1209, 1502 | `typography` (macOS default 13, minimum 10) | Low | S | RC8 | Use `--fs-13` or `--fs-12`; needs visual check for the glyph sizes |
| A-28 | Design system | 93 inline `style=` attributes, 12 of them setting font sizes; the "Projects shown" dialog is built from inline styles while the other dialogs use classes. | I | 2342–2345, 1838, 1866 | – (consistency; no specific HIG page) | Low | M | RC8 | Move to classes when a template is next touched |
| A-29 | Motion | Nine different transition durations (.08 to .35 s) and no easing token. | I | CSS `transition:` rules | `motion` ("brevity and precision") | Low | M | RC8 | `--dur-fast` .1 s, `--dur-base` .18 s, `--dur-slow` .25 s |
| A-30 | Hover | Hover feedback mixes methods: background (64 rules), colour (39), opacity (23), box-shadow (16), and `filter: brightness` on the status pills. | I | 105 `:hover` rules | `buttons` | Low | M | RC8 | Needs visual check; background for rows and controls, opacity only for revealed controls |
| A-31 | Feedback / accessibility | The toast has no `role="status"` or `aria-live`, so VoiceOver does not announce "Moved to Recently Deleted · Undo" or error messages. | H | `#toast` 2428, `showToast` 9146 | `accessibility`, `feedback` ("Make sure all feedback is accessible") | Medium | S | RC9 | `role="status" aria-live="polite"`; errors `role="alert"` **Fixed 2026-10-20.** |
| A-32 | Feedback | 90 toast call sites: 66 plain, 24 with Undo. They hide after 2.4 s (6 s with Undo) even while the pointer or focus is on them. The HIG asks to confirm only significant actions and to minimise time-boxed UI. | B | `showToast` 9146–9156 | `feedback`, `accessibility` ("Minimize use of time-boxed interface elements") | Medium | S | RC9 | Pause the timer on hover and focus-within; review the plain success toasts and drop the routine ones **Fixed 2026-10-20.** |
| A-33 | Accessibility | Hover-only remove badges are 18 × 18 px; table grips and "+" are 12–14 px. The HIG minimum control size on macOS is 20 × 20 pt (28 default). Checkboxes already have a grown hit area; these do not. | H | `.pr-pill-x` and `.pr-chip-x` 1611, `.tbl-plus` 1232, `.tbl-grip.tbl` 1502 | `accessibility` (control sizes) | Medium | S | RC9 | A `::before` with `inset: -4px`; keep the look **Fixed 2026-10-20.** |
| A-34 | Keyboard | ⌃⌘C is Copy Note; the HIG lists ⌃⌘C as "Copy the formatting settings" and says to avoid Control as a modifier. ⌘B is Bold in Notes but toggles the sidebar in Tasks. | H | `shortcutGroups` (shortcut sheet) | `keyboards` | Low | S | RC10 | Pick a free ⌥⌘ combination for Copy Note; keep ⌘B for Bold only |
| A-35 | Icons | The two-squares "clone" drawing means three things: Duplicate (toolbar button, menus), the Prompts mode (All Prompts row, "No prompt selected" and the mode's empty state) and a decoration on some Help rows. Apple's Duplicate is `plus.square.on.square`; an icon should stand for one concept. | B | Duplicate 1861; All Prompts 1759; empty state 1991, 6769; Help rows | `icons` ("expresses a single concept"), `menus` (standard icons) | Medium | S | RC11 | Give Prompts its own icon (for example a text page) and keep the two-squares glyph for Duplicate only |
| A-36 | Icons | Copy is a clipboard in the right-click and ⋯ menus (Copy Note, Copy Prompt) but two sheets on the Copy Prompt button. Apple's Copy is `document.on.document`; the clipboard is Paste. | B | `promptMenuHtml` 7170 area, note menu 5962 area, `#pCopyBtn` | `icons` (standard icons: Copy, Paste) | Low | S | RC11 | Use the two-sheets glyph for Copy everywhere |
| A-37 | Icons | Filter is a funnel; Apple's standard Filter symbol is three lines of decreasing width (`line.3.horizontal.decrease`). | H | `#filterBtn` 1880 area | `icons` (standard icons: Filter) | Low | S | RC11 | Swap the drawing in `ICONS` |
| A-38 | Popovers | The link popover closes on a click outside without applying what was typed. The HIG says to always save work when a nonmodal popover closes by itself and to discard only on an explicit Cancel. | H | `closeNoteLinkBar` 8522, outside-click handling | `popovers` ("Always save work when automatically closing a nonmodal popover") | Low | S | RC6 | Apply a valid address when the popover is dismissed by clicking away; Esc stays "cancel" |
| A-39 | Windows | Help, Shortcuts and About imitate a window's chrome (a round close control where the traffic lights sit, System Settings layout) inside a page overlay. The HIG says not to create custom window UI that only approximates the system's. | H | Help/About dialogs (CLAUDE.md "Help is laid out like macOS System Settings") | `windows` ("Avoid creating custom window UI") | Low | S | RC7 | Keep the layout, but use a plain Close button in the dialog's own footer or title row |
| A-40 | Layout | In a pane of 330 px or less the Prompts toolbar drops the Insert menu altogether, so there is no toolbar way to add a variable (typing the braces still works). The HIG says to change how much is visible with space, not what the app can do. | H | container query `max-width: 330px` | `layout` ("Keep functionality the same as size classes change") | Low | S | RC1 | Keep the menu and give up the Copy label or undo instead; or move Insert into ⋯ |
| A-41 | Drag and drop | Reordering projects in the Tasks sidebar is drag-only; folders in Notes have Move Up / Move Down and ⌥↑ / ⌥↓. | H | `handleProjectDragStart`, `projectMenuHtml` | `drag-and-drop` ("Offer alternative ways to accomplish drag-and-drop actions") | Low | S | RC6 | Add Move Up / Move Down to the project's right-click menu |
| A-42 | Dialogs | The Global Variables dialog shows its Values +/− bar even when no variable exists (both buttons greyed) above an empty-state message. | I | `#globalsModalBg` main pane | `lists-and-tables` (empty states) | Low | S | RC6 | Hide the right-hand bar until a variable is selected |

**Counts:** 42 findings. High 1, Medium 10, Low 31. Type: HIG deviation 22, Inconsistency 12, Both 8. Eight were fixed on 2026-10-20 (A-01, A-02, A-04, A-07, A-09, A-13, A-31, A-32, A-33); A-21 is kept by decision.

**Checked and conforming** (no finding): menu labels in title-style capitalisation, an ellipsis for commands that need input, undo and redo shortcuts ⌘Z and ⇧⌘Z, ⌥⌘I for the inspector, the inspector toggle on the trailing edge, `cursor: default` on controls (hand only on links), one focus ring, reduced-motion support, one close path for dialogs, dialog roles and names, no hard-coded colours outside tokens, one icon family with a size scale, ellipsis plus tooltip on truncated rows, solid-accent selection in every list.

---

## 6. Proposed consistency rules

| Category | Rule |
|---|---|
| Components | Before adding a control, look for an existing one in CLAUDE.md: one add control, one empty state, one popover base |
| Surfaces | Surfaces use `--bg`, `--bg-2`, `--bg-3` or the glass tokens; no raw colours outside token definitions and print |
| Modals | A dialog says Done only if it applies live (then call it Close); otherwise Cancel plus a verb-labelled primary; one dialog at a time; alerts only for permanent, un-undoable actions |
| Modal placement | Title, one-line description, content, then actions at the bottom right with Cancel left of the primary; 24 px side padding |
| Context menus | Right-click menus list only available commands, no shortcut hints, the destructive item last and red, at most three groups |
| Controls | The primary action is trailing; at most three toolbar groups; icon-only controls carry `aria-label` and `title` |
| Navigation | Same mode switch, same sidebar rows, selection is the solid accent |
| Forms | Label above the field or in its placeholder; Return confirms, Esc cancels; validate on commit with a message in place |
| Lists | Ellipsis plus the full text in the tooltip; selection is the solid accent row |
| Empty states | One component: optional icon, one sentence, optional single action |
| Feedback | Toast for Undo and errors only; announced with `role="status"`; paused while pointed at or focused |
| Destructive actions | Recoverable: no alert, an Undo toast. Permanent: an alert with the verb ("Delete", "Unlink") |
| Typography | Only `--fs-11` to `--fs-22`; no `calc()` on sizes; weights 400, 500, 600, 700 |
| Icons | Outline SVG from `ICONS`, sizes 12/14/16/18, stroke 2, `currentColor` |
| Hover and states | Rows: `--bg-2`; controls: `--hover`; pressed: `--pressed`; revealed controls: opacity |
| Tooltips | Native `title` on every icon-only control, text equal to its `aria-label` |
| Spacing | 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40 |
| Shapes | The radius ladder `--r-xs` to `--r-xl`, pill, circle |
| Motion | `--dur-fast/base/slow`; nothing animates under reduced motion |
| Keyboard | No Control modifier; do not reuse a HIG standard key for another command; one meaning per key across modes |
| Windows and responsive | Every pane has a minimum width and a collapse order (inspector, list, sidebar) |
| Accessibility | Text contrast at least 4.5:1; hit areas at least 20 × 20 px; every transient message has a live region |
| Wording | Title-style menu items; one word per concept across modes (Duplicate, Delete, Recently Deleted) |

---

## 7. Needs visual check

Checked on 2026-10-20 with headless Chrome (screenshots and a script that composites each text colour over its real background):

| Item | Result |
|---|---|
| Prompts in the light theme | Looks right in the template, the Variables panel (all four variable kinds, pills, presets, checklist) and the list. A contrast scan of every text run found nothing under 4.5:1 (its one hit, the white "Copy Prompt" label, is a false alarm: the button is a gradient the scan cannot read). The dark theme scans clean as well |
| Global Variables dialog, many values and long names | 40 values scroll inside the list; a very long value wraps (even without spaces); a long variable name is cut with an ellipsis in the left list and the hint under the Name field wraps; at a 640 px window the dialog fits. Only A-42 (a bar with nothing above it when no variable exists) turned up |
| Tick spacing in the Notes toolbar's list-style menu | The tick sat directly against the bullet glyph because that menu had its own 14 px tick column. Fixed: it now uses the shared 22 px column |
| A-17, A-25, A-27, A-30 | Still not confirmed from code; low priority |
| VoiceOver | Reading order of the Prompts panel and focus order of the Global Variables dialog still need a real screen reader |

## 8. Skipped categories

| Category | Reason |
|---|---|
| The menu bar | A web app in a browser has no app menu bar, so the HIG's File, Edit and View menus cannot be provided; the toolbar rule "every toolbar item is also a menu command" cannot be tested |
| Loading states | All data is local; nothing waits long enough to need a spinner or progress bar |
| Window behaviour (multiple windows, full screen, minimum window size) | The browser owns the window; only layout at narrow widths applies (A-01, A-02) |
| Drag and drop | Now covered (A-41); notes and prompts drop onto folders with a highlight and an Undo toast, locked items are refused |
| Sort indicators on tables | Covered by the previous audit and unchanged |
