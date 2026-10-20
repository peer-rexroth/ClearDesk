# MyDesk – UX/UI audit (consistency + Apple HIG)

Scope: `mydesk.html` (~8,025 lines), single-file PWA, Tasks mode and Notes mode. Read-only audit, no code changed.
Method: static reading of CSS/JS, computed inventories (grep counts), and headless-Chrome measurements of rendered sizes at 1400px width. HIG pages were fetched from `https://developer.apple.com/design/human-interface-guidelines/<page>.md` before judging. Line numbers are from the current file; "~" means approximate (±10 lines).

---

## 1. Summary

**Platform / UI stack.** Web app (installable PWA) used on macOS desktop browsers/Dock. Plain HTML + CSS + vanilla JS, no framework or build step. One visual scheme ("Glass", `html[data-scheme="glass"]`) with light and dark themes. Icons: Font Awesome 6.5 (CDN) plus a growing set of inline SVG. System font stack (`-apple-system` first). The HIG is applied as a *look and behaviour* reference for macOS; native-only features (menu bar, system accent colour, Dynamic Type, VoiceOver rotor) cannot be confirmed or are not reachable from the web.

**Assessment.** The app is visually close to macOS: translucent sidebar, opaque content, 0.5px hairlines, pill segmented controls, SVG context-menu icons and a coherent token system (67 custom properties, ~765 `var(--…)` uses). Consistency is strong where a feature was designed recently (Notes menus, table tools, link popover, menu icon registry) and weaker in older parts (modals, Tasks sidebar, Font Awesome icons, one-off radii/shadows/paddings). The biggest *functional* HIG conflict is keyboard: ⌘B is taken for the sidebar and blocks Bold. The biggest *systemic* gaps are accessibility (no reduced-motion support, partial dialog semantics, secondary text contrast, sub-minimum hit targets) and token drift (hard-coded colours, several "accent" blues, 19 font sizes, 35 shadows, 112 padding values).

**Five most important issues**
1. **F-01 ⌘B toggles the sidebar and swallows Bold in notes** (confirmed by test). HIG keyboards lists ⌘B as Bold.
2. **F-02 No `prefers-reduced-motion` handling** while 27 transition definitions, 2 keyframes and a 0.2s drawer animation exist.
3. **F-03 Five of eleven modals lack dialog semantics** (`role="dialog"`/`aria-modal`), and close behaviour differs between modals.
4. **F-04 Tertiary text and small controls fall below HIG minimums**: `--text-3` ≈ 3.2:1 (light) and ≈ 4.2:1 (dark) against 4.5:1; task checkbox 19×19 and subtask check 16×16 against the 20×20 macOS minimum.
5. **F-05 Token drift**: 131 hard-coded hex + 114 rgba values in CSS, 4 competing accent blues, mixed Font Awesome/SVG icon sets, mixed menu-label capitalisation.

---

## 2. Inventory

### 2.1 Background colours and surfaces
| Surface | Light | Dark | Where |
|---|---|---|---|
| Content (`.main`, `.drawer`, `.notes-main`) | `--bg #fff`, `--bg-2 #f6f6f9`, `--bg-3 #ececf1` | `#1e1f24 / #26272d / #31323a` | ~762–770 |
| Sidebar / toolbar chrome | translucent glass (`--glass-strong`, backdrop blur) | same, dark tokens | ~712–760 |
| Menus, popovers (`#rowMenu`, `.note-link-pop`) | Glass menu surface, radius 16 | same | Glass menu rules |
| Modal | `--bg` (translucent in some contexts) + backdrop | | 351–358, 551–553 |
| Selection / accent | `--sel-bg #2f6fde` | `#2c62c9` | 873–874 |
| Focus ring | `--focus-ring #9bbcf6` | `#417391` | ~938 |
| Status tints | blue/teal/amber/red/green/purple `-bg` + `-text` | dark variants | tokens |

### 2.2 Modals (11 `.modal-bg`, lines ~1636–1987)
| Modal | role=dialog | Backdrop closes via | Actions (order) |
|---|---|---|---|
| confirmModalBg | no | `closeAllModals` | Cancel, **Delete** (danger) |
| folderModalBg | no | `closeAllModals` | Cancel, Save/Create |
| projectModalBg | no | `closeAllModals` | Cancel, Save/Create |
| importModalBg | no | `closeAllModals` | Cancel, Merge/Replace |
| allTasksProjectsModalBg | no | `closeAllModals` | Done |
| helpModalBg | yes | `closeAllModals` | Done |
| aboutModalBg | yes | `closeAllModals` | Done |
| shortcutsModalBg | yes | `closeAllModals` | Done |
| fileSyncModalBg | yes | dedicated closer | Not now / … |
| newFileModalBg | yes | dedicated closer | Cancel / Create |
| dataFilesModalBg | yes | dedicated closer | Done |

Sizing: `.modal` 380px wide, `h3` 15px / `p` 13px (351–358), overridden to 17px / 14px at 552–553; shadow `0 8px 32px rgba(0,0,0,.18)` hard-coded (353) then overridden (551).

### 2.3 Context menus
| Menu | Trigger | Builder |
|---|---|---|
| Task row / board card | right-click, ⋯ | `openRowMenu` ~2773, `rowMenuHtml` ~3215 |
| Notes folder row | right-click (line ~5634) | `folderMenuHtml` ~5539 |
| Note row | right-click (~5665) | `noteMenuHtml` ~5496 |
| Note body (link / table cell) | right-click (`onNoteContextMenu`) | `noteLinkMenuHtml` ~6657, `noteTableMenuHtml` ~6332 |
| Table grip (row / column / table) | click / right-click | `tblGripMenuHtml` ~6543, `tblTableMenuHtml` ~6610 |
| Tasks sidebar project row (~2563) | **none** | – |

### 2.4 Placement of controls
| Area | Controls |
|---|---|
| Sidebar | mode switch, nav items (275×37), projects/folders, settings |
| Tasks toolbar | view switch (110×30), selects (36 high), quick-add (950×39), tool buttons 34×30 |
| Notes toolbar | format tools 36×30 (single row, collapses by width: Clear formatting <740px, Undo/Redo <720px), lock/copy/more in main action bar |
| Modals | Cancel left of primary, primary trailing; Esc/backdrop dismiss |
| Overlays | table grips + "+" in `#tblHandles`, code-copy chip top-right of code block, link popover anchored to link |

### 2.5 Typography (19 distinct sizes, 6–30px)
| Role | Computed |
|---|---|
| Body (root) | 16 / 400 / 24 |
| Note title | 28 / 700 / 35 |
| Note body | 15 / 400 / 24.75 |
| Notes list title | 17 / 700; note row title 14 / 600 |
| Sidebar nav | 14 / 500; section label 12 / 600 |
| Toolbar selects | 13 / 500 |
| Meta | 12 |
| Most used sizes | 13px ×55, 12px ×48, 11px ×31, 14px ×31, 15px ×11, 16px ×8 |
| Weights | 500 ×29, 600 ×18, 700 ×13 (no 400 headings, no 800+) |
| Families | `var(--font)` ×25, `var(--mono)` ×5, one `Georgia` |
| Sub-10px | icon glyphs only (e.g. `.tbl-plus` 6px, grips 8–9px) |

### 2.6 Icons
| Set | Count | Size / stroke |
|---|---|---|
| Font Awesome | 264 uses, 95 distinct (214 solid, 63 regular) | 12–16px glyph |
| Inline SVG | 31 inline + `MENU_SVG` registry (32) | 16px, stroke 1.7 |
| Toolbar icon family `.tb-ico2` | 20 uses | 18px box, stroke 1.7 |
| Menu icons `.row-menu-item i` | – | 16px |
| `.icon-btn` | 42 | font-size 12px, ≈20×21 |

### 2.7 Hover / interaction states
| Item | Value |
|---|---|
| Hover rules | 62 (background 50, colour 25, shadow 10, border 8, opacity 5) |
| Hover backgrounds | `--bg-2` ×10, `--bg-3` ×9, `--cap-hover` ×6, `rgba(255,255,255,.45)` ×2, others |
| Focus | `:focus-visible` rules 23; `outline:none` 23; `--focus-ring` in 5 places |
| Cursors | pointer 37, default 13, text 4, col-resize 7, grab 1 |
| Selection | `--sel-bg` solid blue with white text |

### 2.8 Spacing and layout
| Item | Value |
|---|---|
| Distinct `padding` values | 112 (most common `10px 12px` ×7) |
| `gap` | 1–18px: 8 ×24, 10 ×16, 6 ×14, 4 ×9, 2 ×8 |
| Content width | notes editor max 900px, left aligned |
| Row heights | task row 57, note row 59, nav item 37 |

### 2.9 Shapes and depth
| Item | Value |
|---|---|
| Radii | `var(--radius)` 10 ×34, 999px ×18, 50% ×16, 4px ×12, 8px ×7, 6px ×7, plus 2,3,5,10,12,14,20px, 22% one-offs; tokens `--radius-lg 14`, `--glass-r-row 8`, `--glass-r-bar 12`, `--glass-r-menu 16` |
| Borders | 0.5px ×36, 1px ×44, 1.5px ×6 |
| Shadows | 35 distinct; `var(--shadow)` ×11, `--glass-shadow` ×1, modal hard-coded |

### 2.10 Motion
| Item | Value |
|---|---|
| Transitions | 27 distinct, durations .08–.35s (.12s ×12, .15s ×16, .2s ×16) |
| Keyframes | `rowSettle`, `checkPop` |
| `prefers-reduced-motion` | **absent** |
| `prefers-reduced-transparency`, `prefers-contrast` | handled (~710, ~829) |

### 2.11 Keyboard
| Scope | Shortcuts (`shortcutGroups()` ~4836) |
|---|---|
| Global | `/` search, `N` new, `⌘B` sidebar, `?` help, `Esc` |
| Tasks | arrows, `↵`, Space collapse, Tab add subtask, Delete, `⌘Z`, `⌘`/`⇧` click, `⌘A`, `F2` |
| Notes | `⌘B/I/U` (B conflicts), `⌘K`, `⌘⇧C` copy note, `⌘P`, `⌘↵`, Tab/⇧Tab list indent |

### 2.12 Accessibility
`aria-label` ×82, `role=` ×106, `title=` ×122, `aria-live` ×4, `aria-pressed` ×20, `aria-expanded` ×4, `aria-haspopup` ×16. 5 of 42 `.icon-btn` have neither title nor aria-label. Native `<select>` ×13, native checkbox/radio ×0 (custom controls).

Rendered control sizes (1400px): task checkbox 19×19, subtask mini-check 16×16, row action button 25×23, `.icon-btn` 19.8×21, toolbar tool 34×30 / 36×30, round buttons 36×36.

### 2.13 Wording
Titles/buttons: Cancel, Save, Create, Done, Delete, Merge, Replace, **Not now**. Menu items mix sentence case (`Open details`, `Add subtask`, `Copy note`, `Insert row above`, `Header row`) and title case (`Pin Note`, `Remove Link`, `Delete Permanently`, `Edit Link…`, `Copy Link`, `New Message`). Shortcut hint "Del" appears in context menus (~3237, ~5514).

### 2.14 Contrast estimates (computed from token alphas; see §5)
| Pair | Ratio | HIG 4.5:1 |
|---|---|---|
| `--text-2` on `#fff` | 6.2:1 | pass |
| `--text-3` on `#fff` | 3.2:1 | **fail** |
| `--text-3` on `#f2f3f7` | 3.15:1 | **fail** |
| `--text-2` on `#1e1f24` | 8.0:1 | pass |
| `--text-3` on `#1e1f24` | 4.2:1 | **fail (borderline)** |
| white on `--sel-bg` light / dark | 4.7 / 5.7 | pass |
| `--red-text`, `--blue-text`, `--green-text`, `--amber-text` (light) | 5.7 / 5.9 / 5.4 / 6.8 | pass |
| Note colour orange `#c2570c` on white | 4.5 | edge |

---

## 3. Findings

Type: **I** = Inconsistency, **H** = HIG deviation, **B** = Both. Base URL: `https://developer.apple.com/design/human-interface-guidelines/`.

| ID | Category | Finding | Type | Locations | HIG reference | Severity | Recommendation |
|---|---|---|---|---|---|---|---|
| F-01 | Keyboard | Global `handleSidebarShortcut` binds ⌘B to "toggle sidebar" and calls `preventDefault()`; in a note, ⌘B with text selected toggles the sidebar and does not bold (headless test: default prevented = true, sidebar toggled = true). Shortcuts list shows both ⌘B uses. | B | `mydesk.html` ~7276–7279; `shortcutGroups()` ~4836 | keyboards (standard shortcuts: ⌘B Bold), sidebars | High | Move sidebar toggle to ⌥⌘S (macOS convention) or only handle ⌘B when focus is outside `#noteBody`. Update shortcut sheet. |
| F-02 | Keyboard | ⌘⇧C is bound to Copy note; on macOS it opens the Colors panel and is Chrome's inspect shortcut. | H | notes keydown, `shortcutGroups()` | keyboards | Low | Choose a non-system combo (e.g. ⌥⌘C) or keep and document; verify in Safari/Chrome. |
| F-03 | Motion | No `prefers-reduced-motion`. Drawer width, menus, check pop, row settle and 27 transitions always run. | H | all `transition:`; keyframes `rowSettle`, `checkPop`; `.drawer` ~775 | motion, accessibility | Medium | Add a global `@media (prefers-reduced-motion: reduce)` that zeroes durations and disables keyframes; keep opacity fades only. |
| F-04 | Modals | 5 of 11 modals (confirm, folder, project, import, allTasksProjects) lack `role="dialog"`, `aria-modal`, and labelled-by. The confirm dialog (destructive) is among them. | B | 1636–1987 | modality, alerts, accessibility | Medium | Add `role="dialog"` (or `alertdialog` for confirm), `aria-modal="true"`, `aria-labelledby` the `h3`; trap focus and restore it on close. |
| F-05 | Modals | Close behaviour is inconsistent: most use `closeAllModals()`, three use dedicated closers; labels vary ("Done", "Not now", "Cancel"). | I | fileSync/newFile/dataFiles modals | modality, alerts | Low | One `closeModal(id)` path; Esc and backdrop identical everywhere; document label rule (§4). |
| F-06 | Modals | Styles are layered and contradictory: `h3` 15→17px, `p` 13→14px, shadow hard-coded then overridden. Dead rules risk drift. | I | 351–358 vs 551–553 | – | Low | Remove superseded rules; define modal tokens (title, body, shadow, radius). |
| F-07 | Modals | Centred dialogs are used for form-like tasks (folder, project, import) where macOS uses sheets attached to the window. | H | folder/project/import modals | sheets, modality | Low | Optionally anchor to top-centre with slide-down; at minimum keep the destructive confirm as alert. |
| F-08 | Modals | Destructive confirm uses a red `btn-danger` in the trailing (default) position; HIG says to avoid making a destructive action the default and to prefer a safe default. | H | confirmModalBg | alerts | Medium | Make Cancel the default (focus + Return) for destructive confirms; keep Delete red but not auto-focused. |
| F-09 | Context menus | Tasks sidebar project rows have no context menu while Notes folder rows do (rename/delete/move). | I | ~2563 vs ~5634 | context-menus | Medium | Add `oncontextmenu` to project rows with the same builder pattern as `folderMenuHtml`. |
| F-10 | Context menus | Capitalisation mixed: sentence case (`Open details`, `Insert row above`) vs title case (`Pin Note`, `Remove Link`, `Delete Permanently`, `Edit Link…`). HIG menus use title-style capitalisation. | B | `rowMenuHtml`, `noteMenuHtml`, `folderMenuHtml`, link/table builders | menus | Medium | Pick one — HIG says title-style — and apply across all builders. |
| F-11 | Context menus | Shortcut hint "Del" shown in context menus, in text rather than the ⌫ symbol. | H | ~3237, ~5514 | menus (keyboard shortcuts), context-menus | Low | Use ⌫ (or drop hints in context menus; they belong in the Help/shortcut sheet). |
| F-12 | Context menus | Locked note shows *disabled* "Move to" and "Delete" with an "Unlock first" hint; other menus hide unavailable items. | I | `noteMenuHtml` ~5496 | menus (disabled items), context-menus | Low | Either always dim with the same hint everywhere, or hide; prefer dim consistently. |
| F-13 | Context menus | Pin, Move up/down, Export, Print exist only in the context menu; no toolbar or other discoverable entry. | H | note/folder menus | context-menus ("don't make context menus the only way") | Low | Mirror Pin/Export/Print in the "⋯" toolbar menu. |
| F-14 | Context menus | Menu icons: some items have SVG icons from `MENU_SVG`, task menu still has Font Awesome glyphs in places; icon column widths differ. | I | `rowMenuHtml`, `menuIconHtml` | menus, sf-symbols | Low | Finish SVG conversion; one 16px icon slot, reserve space for non-icon items. |
| F-15 | Colour | 131 hard-coded hex + 114 rgba values in CSS (e.g. `#fff` ×36 at 79, 90, 221, 247, 329, 348, 412–413, 577–593, 674, 677; `#d92d20` ×4 at 377, 791, 792, 1109 while `var(--red-text)` ×19). Dark mode may not retune them. | I | CSS throughout | color, dark-mode | Medium | Replace with tokens (`--on-accent`, `--danger`); lint for raw hex outside the token block. |
| F-16 | Colour | Four related accent blues: `--sel-bg #2f6fde`, `--blue-text`, `--glass-accent` gradient, `--focus-ring`, plus `--blue-dot #0a84ff`. | I | tokens ~712–760, 873, 938 | color | Medium | Collapse to one `--accent` + derived states (hover, pressed, tint, ring). |
| F-17 | Colour | Accent is fixed; it does not follow the system accent colour. Web limitation (`AccentColor` keyword is unreliable cross-browser). | H | tokens | color | Low | Consider CSS `accent-color: AccentColor` for native controls; keep blue default. |
| F-18 | Colour | In-app Light/Dark/Auto setting overrides system appearance. | H | `themePref` ~7530 | dark-mode (follow system, avoid app-specific toggle) | Low | Default Auto (already); keep override but tuck it in Settings. |
| F-19 | Colour / a11y | Secondary text `--text-3` ≈ 3.2:1 (light), ≈ 4.2:1 (dark) vs 4.5:1 minimum for body-size text. Used for meta, timestamps, placeholders, section labels. | H | `--text-3` usage; `.notes-meta`, section labels | color (contrast), accessibility | High | Darken `--text-3` to reach ≥ 4.5:1 on all content surfaces (≈ alpha .60 light, .55 dark). Confirm visually (§5). |
| F-20 | Typography | 19 distinct font sizes (6–30px); the macOS scale is Body 13pt with 10pt minimum. Body root is 16px but most UI is 13/12/11, so there are effectively two systems. | B | CSS throughout | typography | Medium | Define 7–8 type tokens (caption 11, small 12, body 13, callout 14, title3 15, title2 17, title1 22, large title 28) and map existing sizes. |
| F-21 | Typography | Sub-10px glyphs for icons (`.tbl-plus` 6px, grips 8–9px, lines 89, 96, 246, 254, 328, 430, 858, 1071, 1098, 1362, 1365). Text is fine; icon glyphs are small touch/click targets. | H | listed lines | typography (minimum size), buttons | Low | Keep visual glyph small but extend hit area to ≥ 20×20 via padding/pseudo-element. |
| F-22 | Typography | Weights: only 500/600/700; 700 for note title (28) vs 600 for most headings. Georgia appears once. | I | one `Georgia` rule | typography | Low | Remove Georgia or document it as the "serif note style"; restrict headings to 600 + 700 for large title only. |
| F-23 | Typography | Fixed px sizes with CSS `zoom`; UI scale offers two stops (100%, 115%). Does not follow browser/system text-size. | H | `UI_SCALE_STEPS` | typography (Dynamic Type), accessibility | Low | Convert to `rem`, add 90/100/115/130 steps. |
| F-24 | Icons | Mixed families: Font Awesome solid and regular (264 uses/95 glyphs) beside 1.7-stroke SVGs. Weight, optical size and metaphor differ (e.g. solid sidebar icons vs outline toolbar icons). | I | sidebars, dialogs, help, dropdowns, tick marks, project icons | icons, sf-symbols | Medium | Finish the SVG migration surface by surface (sidebar → dialogs → dropdowns) and drop Font Awesome; or standardise on regular weight. |
| F-25 | Icons | Icon sizes vary: 12px (`.icon-btn`), 13/16 (`.pop-icon`), 16 (menus), 18 (toolbar). | I | `.icon-btn`, `.pop-icon`, `.row-menu-item i`, `.tb-ico2` | icons | Low | Three sizes: 14 inline, 16 menu/list, 18 toolbar. |
| F-26 | Icons / a11y | 5 of 42 `.icon-btn` have no `title` or `aria-label`. | H | `.icon-btn` markup | accessibility, buttons | Medium | Add labels; add a lint test (query `.icon-btn:not([aria-label])`). |
| F-27 | Hit targets | Task checkbox renders 19×19, subtask mini-check 16×16, `.icon-btn` ≈ 20×21, row action button 25×23. HIG macOS minimum 20×20 (default 28×28). | H | task row CSS (checkbox), subtask check, `.icon-btn` | buttons, pointing-devices, accessibility | Medium | Checkbox 20px visual with 28px hit area; subtask check ≥ 20px; row actions ≥ 28×28. |
| F-28 | Interaction | Hover backgrounds drawn from five different sources (`--bg-2`, `--bg-3`, `--cap-hover`, `rgba(255,255,255,.45)`, others); no common "hover/pressed/selected" ladder. | I | 62 hover rules | color, buttons | Low | Three tokens: `--hover`, `--pressed`, `--selected`. |
| F-29 | Interaction | 23 `outline:none` vs 23 `:focus-visible` rules; the focus ring colour is applied in only 5 places, so some controls may show no visible focus. | B | CSS | accessibility (keyboard), focus and selection | Medium | One global `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px }`; remove per-control `outline:none` where no replacement ring exists. Needs visual check. |
| F-30 | Interaction | Cursor usage: `pointer` on 37 controls, `default` on 13 — HIG pointing-devices: buttons use arrow, pointer hand only for links. | H | CSS | pointing-devices | Low | Use `default` for buttons/rows, `pointer` for text links only; keep `col-resize`/`grab`. |
| F-31 | Layout / spacing | 112 distinct padding values, gaps 1–18px with no scale. | I | CSS | layout | Low | Adopt a 4pt scale (4/8/12/16/20/24) and map. |
| F-32 | Shapes | One-off radii (2,3,5,10,12,14,20px, 22%) beside tokens `--radius 10/14`, `--glass-r-*`. | I | CSS | layout, materials | Low | Radius ladder: 4 (chip), 8 (row/control), 10 (card), 12 (bar), 16 (menu/modal), pill. |
| F-33 | Depth | 35 distinct `box-shadow` values; modal shadow hard-coded (353, 551). | I | CSS | materials | Low | 3 elevations: `--shadow-1` (cards), `--shadow-2` (menus/popovers), `--shadow-3` (modals). |
| F-34 | Layout | Note editor is capped at 900px and left aligned while task list rows span 1072px; wide screens show different gutters between modes. | I | `.notes-main` vs `.main` | layout | Low | Same max readable width in both modes or document the difference. Needs visual check. |
| F-35 | Wording | Button labels: "Not now" (fileSync) vs Cancel/Done elsewhere; menu items end with "…" inconsistently (`Edit Link…` has it; other commands that open a dialog may not). | I | fileSync modal; menu builders | menus (ellipsis), alerts | Low | Use "…" only for commands needing more input; use Cancel/Done/primary verb only. |
| F-36 | Platform | No menu bar; commands reachable only through toolbar, context menus, shortcuts. Web limitation. | H | – | menus (menu bar), keyboards | Low | Provide a "⋯" app menu and the `?` shortcut sheet (exists); keep both in sync. |
| F-37 | Controls | 13 native `<select>` elements next to custom segmented controls and popover menus; selects render with OS chrome in Chrome but differently in Safari/Firefox. | I | toolbar selects | pop-up-buttons, segmented-controls | Low | Replace with the app's menu popover for visual consistency, or restyle `appearance:none` + chevron. Needs visual check. |
| F-38 | Hover | `.tbl-plus` and grip handles appear only on hover; no keyboard alternative for adding rows/columns except menus. | H | `#tblHandles` | accessibility, pointing-devices | Low | Keep; ensure the table context menu is keyboard-reachable (Shift+F10 / menu key). |

---

## 4. Proposed consistency rules

| Category | Rule |
|---|---|
| Surfaces | Content surfaces are opaque `--bg`; chrome (sidebar, toolbar, menus, popovers) uses the Glass material. No raw hex; every colour is a token with a dark pair. |
| Modals | Every modal has `role="dialog"` (`alertdialog` for confirmations), `aria-modal`, a labelled title, Esc + backdrop close through one function, and focus restore. |
| Modal actions | Cancel on the left, primary trailing; destructive confirms default-focus Cancel; informational dialogs have a single "Done". |
| Context menus | Same builder pattern everywhere: title-style labels, 16px SVG icon slot, "…" only if more input follows, hide unavailable items (dim only when a hint explains why), no shortcut hints. |
| Control placement | Mode/navigation left, view controls centre, create/lock/copy/more right in the main action bar; anything in a context menu is also in the "⋯" menu. |
| Typography | Use the 8 type tokens only; sizes below 11px are for icon glyphs only; weights 400/500/600/700. |
| Icons | One SVG family, stroke 1.7, sizes 14/16/18; every icon-only button has an `aria-label`. |
| Interaction | Hit target ≥ 28×28 (visual may be smaller, never below 20×20); one hover/pressed/selected ladder; global `:focus-visible` ring; arrow cursor on buttons. |
| Spacing & layout | 4pt spacing scale; one max readable width for text-heavy panes. |
| Shapes & depth | Radius ladder 4/8/10/12/16/pill; three shadow elevations. |
| Motion | Durations 0.12s (hover), 0.2s (panels), 0.3s (sheets); all disabled or reduced to opacity under `prefers-reduced-motion`. |
| Keyboard | Standard macOS shortcuts keep their meaning (⌘B/I/U, ⌘Z, ⌘A, ⌘P, ⌘K); app commands avoid system-reserved combos; every command appears in the `?` sheet. |
| Accessibility | Text ≥ 4.5:1 (large text ≥ 3:1); `prefers-reduced-motion/transparency/contrast` all honoured; dialogs and menus use correct ARIA roles. |
| Wording | Title-style menu items; verbs for buttons; no "Not now"; sentence-style for descriptions and hints. |

---

## 5. Needs visual check

1. **Text contrast (F-19).** Ratios were computed from token alpha values against opaque `--bg`; real colours depend on Glass blur behind the sidebar and on user zoom. Check `--text-3` on sidebar, toolbar and note rows in both themes.
2. **Focus visibility (F-29).** Confirm each of the 23 `outline:none` controls shows a visible focus indicator by Tab-walking Tasks, Notes, all modals and the table tools.
3. **Rendered sizes under UI scale 115% (F-27).** Measurements were at 100%; CSS `zoom` may push some targets above 20px.
4. **Hover ladder (F-28).** Check hover vs selected vs pressed distinction on task rows, note rows, menu items and toolbar buttons in dark mode.
5. **Native select styling (F-37).** Compare in Safari and Chrome on macOS.
6. **Wide-screen gutters (F-34).** Compare Tasks and Notes at 1400+ and 2560px.
7. **Modal vs sheet feel (F-07, F-08).** Judge whether dialogs read as alerts or as forms and whether default-focus behaviour feels right.
8. **Shortcut collisions (F-01, F-02).** Verify ⌘⇧C and the proposed ⌥⌘S in Safari, Chrome and as an installed PWA, which differ in reserved shortcuts.
9. **Orange note colour (`#c2570c` on white, 4.5:1)** is on the edge; check legibility on tinted note backgrounds.

---

## 6. Resolution status (updated after the fixes)

| ID | Status |
|---|---|
| F-01 | Fixed: sidebar toggle is ⌥⌘S / Ctrl+Alt+S; ⌘B / Ctrl+B only toggles it in Tasks, in Notes it is Bold |
| F-03 | Fixed: `prefers-reduced-motion: reduce` collapses animations and transitions |
| F-04 | Fixed: all 11 modals have `role="dialog"` (confirm: `alertdialog`), `aria-modal` and an accessible name |
| F-09 | Fixed: Tasks sidebar projects have a right-click menu (New Task Here, Edit, Delete) |
| F-10, F-11, F-14 | Fixed: title-style menu labels, ⌫ hint, one icon registry for menus |
| F-15, F-16, F-28, F-33 | Mostly fixed: colour, accent, hover and elevation tokens; a few one-offs remain |
| F-19 | Fixed by calculation: `--text-3` ≥ 4.5:1 on the content surfaces and on selected rows; still needs a visual check on translucent Glass chrome |
| F-24, F-25, F-26 | Fixed: Font Awesome removed, icon scale 12 / 14 / 16 / 18, icon buttons labelled |
| F-29 | Fixed for native selects, help panes and note rows (found by a scripted focus scan of Tasks, the drawer, all modals and Notes); the note title and body keep only the caret by design |
| Others | Open |
