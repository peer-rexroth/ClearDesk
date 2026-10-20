# MyDesk – UX/UI audit: final report (consistency + Apple HIG)

Scope: `mydesk.html` (single-file PWA, Tasks mode and Notes mode, about 8,200 lines now). The audit was first run read-only; every finding was then worked through and re-checked. This is the closing state.

Method: static reading of the CSS and JS, counted inventories, rendered measurements in headless Chrome (sizes, hit-testing, a scripted focus walk through Tasks, the drawer, all 11 dialogs and Notes), and contrast calculated from the colour tokens. The Apple Human Interface Guidelines were the only reference for conformance findings; their pages were fetched (`https://developer.apple.com/design/human-interface-guidelines/<page>.md`) before judging.

---

## 1. Summary

**Platform and stack.** An installable web app used on macOS desktop browsers. Plain HTML, CSS and vanilla JS, no framework and no build step. One visual scheme ("Glass") in light and dark themes. System font stack, inline SVG icons (no icon font), 114 CSS custom properties. Things only a native app can do (menu bar, the system accent colour, Dynamic Type) are out of reach and are listed as limits, not defects.

**Result.** The audit raised 38 findings. **32 are fixed, 3 are partly fixed on purpose, and 3 are limits of the web platform.** All five of the issues rated most important at the start are fixed.

**The five most important issues, and what happened**
1. **⌘B stole Bold in Notes** (it toggled the sidebar). The sidebar toggle is now ⌥⌘S; ⌘B only toggles it in Tasks and is left to the editor in Notes.
2. **No reduced-motion support.** `prefers-reduced-motion: reduce` now collapses every animation and transition.
3. **Five of the eleven dialogs had no dialog semantics, and closing differed.** All 11 carry `role="dialog"` (the delete confirmation is an `alertdialog`), `aria-modal` and a name; one `closeModal` path serves every close.
4. **Secondary text and small controls were below the HIG minimums.** The faint text colour now calculates to at least 4.5:1 on the content surfaces; checkboxes and small controls have 20px-plus click areas without changing their look.
5. **Token drift** (hard-coded colours, several accent blues, 19 font sizes, 112 padding values, one-off radii, mixed icon sets). Now: tokens for colour, a 7-step type scale, a spacing scale, a 5-step radius ladder, and one inline-SVG icon family at four sizes.

**What changed in numbers**
| Measure | Before | After |
|---|---|---|
| Hard-coded colour values in CSS rules | 245 | 5 (two print rules and three `--cap-*` fallbacks) |
| Distinct text sizes | 19 | 7 named (`--fs-*`) plus glyph sizes inside controls |
| Distinct single padding values | 27 | 16 (a defined scale; 1px hairlines allowed) |
| Corner radii | about 25 distinct values | `--r-xs/s/m/l/xl` plus pill and circle |
| Icon sets | Font Awesome (264 uses) plus SVG | one SVG registry, sizes 12 / 14 / 16 / 18 |
| Dialogs with dialog semantics | 6 of 11 | 11 of 11 |
| Controls with a hand cursor | 37 | 2 rules (links only) |

---

## 2. Findings and resolution

Type: **I** inconsistency, **H** HIG deviation, **B** both. Status: **Fixed**, **Partly** (done, with a deliberate remainder), **Limit** (cannot be done on the web). HIG pages are under `https://developer.apple.com/design/human-interface-guidelines/`.

| ID | Category | Finding | Type | Severity | HIG page | Status and resolution |
|---|---|---|---|---|---|---|
| F-01 | Keyboard | ⌘B toggled the sidebar and blocked Bold in notes | B | High | keyboards, sidebars | **Fixed.** Sidebar is ⌥⌘S / Ctrl+Alt+S; ⌘B toggles it in Tasks only |
| F-02 | Keyboard | ⌘⇧C for Copy Note clashes with macOS and Chrome | H | Low | keyboards | **Fixed.** Now ⌃⌘C (Ctrl+Alt+C); shortcut sheet updated |
| F-03 | Motion | No `prefers-reduced-motion` | H | Medium | motion, accessibility | **Fixed.** One media query collapses durations and animations |
| F-04 | Dialogs | Five dialogs lacked `role="dialog"`, `aria-modal`, a name | B | Medium | modality, alerts | **Fixed.** All 11 labelled; confirmation is an `alertdialog` |
| F-05 | Dialogs | Three dialogs closed through their own code | I | Low | modality | **Fixed.** One `closeModal(id)`; Esc, backdrop and buttons all use it; focus returns to the opener |
| F-06 | Dialogs | Contradictory leftover CSS (15→17px title, double shadow) | I | Low | – | **Fixed.** One rule set; the surface comes from the shared Glass rules |
| F-07 | Dialogs | Centred dialogs instead of sheets | H | Low | sheets | **Limit.** A style choice with little benefit; left as is |
| F-08 | Dialogs | Destructive confirmation had Delete as the default | H | Medium | alerts | **Fixed.** Cancel is focused, so Return cancels |
| F-09 | Menus | Tasks sidebar projects had no right-click menu | I | Medium | context-menus | **Fixed.** New Task Here, Edit, Delete (dimmed for the locked Inbox) |
| F-10 | Menus | Mixed sentence-style and title-style labels | B | Medium | menus | **Fixed.** Title-style everywhere ("Open Details", "Insert Row Above") |
| F-11 | Menus | "Del" hint in context menus | H | Low | menus | **Fixed.** ⌫ symbol |
| F-12 | Menus | Unavailable items dimmed in one menu, hidden in others | I | Low | menus | **Fixed.** Dimmed everywhere (locked folder/project/note items, table header items) |
| F-13 | Menus | Commands reachable only by right-click | H | Low | context-menus | **Fixed.** The note ⋯ menu already mirrored Pin/Export/Print; folders reorder with ⌥↑/⌥↓ |
| F-14 | Menus | Menu icons mixed Font Awesome and SVG | I | Low | menus | **Fixed.** One shared icon registry draws the icons everywhere |
| F-15 | Colour | 131 hex and 114 rgba literals in CSS; the same red four times | I | Medium | color, dark-mode | **Fixed.** Tokens for on-accent, danger, overlays, scrims, shadows. Literals remain only in the mail-export HTML (email cannot read variables) and print rules |
| F-16 | Colour | Four competing accent blues | I | Medium | color | **Partly.** One `--accent` with `--accent-hover`/`--accent-tint`; the primary-button gradient is derived from it. Status dots and the soft focus ring are separate on purpose |
| F-17 | Colour | Accent does not follow the system accent colour | H | Low | color | **Limit.** Browsers do not expose it reliably |
| F-18 | Colour | App-level Light/Dark/Auto overrides the system | H | Low | dark-mode | **Fixed.** "Match System" switch is the default; Light \| Dark always visible, dimmed while following the system |
| F-19 | Accessibility | `--text-3` was 3.2:1 (light) and 4.2:1 (dark) | H | High | color, accessibility | **Fixed by calculation.** At least 4.5:1 on content surfaces and on selected rows (deeper light accent). Needs a visual check on translucent chrome |
| F-20 | Typography | 19 font sizes | B | Medium | typography | **Fixed.** Scale 11/12/13/14/15/17/22 as `--fs-*` |
| F-21 | Hit targets | Small glyph controls under 20px | H | Low | buttons, pointing-devices | **Fixed.** Look unchanged; invisible `::before` areas of 20px or more; list arrow is 22px wide |
| F-22 | Typography | A Georgia font and uneven weights | I | Low | typography | **Fixed.** No serif; weights limited to 400/500/600/700 |
| F-23 | Typography | Only two text sizes | H | Low | typography, accessibility | **Fixed.** Four: 90 / 100 / 115 / 130% |
| F-24 | Icons | Font Awesome and SVG mixed; solid and outline | I | Medium | icons, sf-symbols | **Fixed.** Font Awesome removed; one outline family, 2px stroke |
| F-25 | Icons | Icon sizes all over (9–20px) | I | Low | icons | **Fixed.** 12 / 14 / 16 / 18 scale via `--ico-*` |
| F-26 | Accessibility | Icon-only buttons without a name | H | Medium | accessibility, buttons | **Fixed.** All icon buttons labelled |
| F-27 | Hit targets | Task checkbox 19px, subtask check 16px | H | Medium | buttons, pointing-devices | **Fixed.** About 28px click area, same look |
| F-28 | Interaction | Five different hover fills | I | Low | color, buttons | **Partly.** `--hover` and `--pressed` for controls, `--cap-hover` for toolbar capsules, `--bg-2` for rows. Board tiles lift with a shadow instead |
| F-29 | Accessibility | Controls with no visible keyboard focus | B | Medium | accessibility | **Fixed.** Found by a scripted focus walk; selects, help panes and note rows now have rings. Note title and body keep just the caret by design |
| F-30 | Interaction | Hand cursor on buttons | H | Low | pointing-devices | **Fixed.** Arrow on controls, hand only for links |
| F-31 | Layout | 112 padding values | I | Low | layout | **Fixed.** Spacing scale 2/4/6/8/10/12/14/16/20/24/28/32/40 |
| F-32 | Shapes | One-off radii | I | Low | layout | **Fixed.** Ladder 4 / 8 / 10 / 12 / 16 plus pill and circle |
| F-33 | Depth | 35 distinct shadows | I | Low | materials | **Partly.** Three elevation tokens and ink/overlay tokens; about 36 shadow definitions remain, mostly single-use component shadows |
| F-34 | Layout | Different left margins in Tasks and Notes | I | Low | layout | **Fixed.** One `--gutter` (20px); the task list is capped at 1400px and left-aligned, like the 900px note area |
| F-35 | Wording | "Not now" vs Cancel / Done | I | Low | alerts | **Fixed.** "Cancel" |
| F-36 | Platform | No menu bar | H | Low | menus | **Limit.** The shortcut sheet and the app menus are the substitute |
| F-37 | Controls | Native selects look different per browser | I | Low | pop-up-buttons | **Fixed.** Closed control is one custom look; the open list is the system pop-up menu (the HIG pattern), themed with `color-scheme` |
| F-38 | Accessibility | Table handles only under the pointer | H | Low | accessibility, pointing-devices | **Fixed.** Shift+F10 / Menu key opens the table options at the caret; Tab walks cells and adds a row; ⌘/Ctrl+Enter leaves the table |

---

## 3. Current system (the rules the app now follows)

### Surfaces and colour
- Content panes are opaque (`--bg`, `--bg-2`, `--bg-3`); chrome (sidebar, toolbars, menus, popovers, dialogs) uses the Glass material. Every colour is a token with a light and a dark value.
- One accent: `--accent` (light `#2a5fcf`, dark `#2c62c9`) with `--accent-hover`, `--accent-tint`, `--on-accent`, `--danger`. Selected rows use the accent with white text at 0.94 / 0.85 opacity for the secondary levels.
- Text: `--text`, `--text-2` (0.74), `--text-3` (0.62 light / 0.56 dark), all at least 4.5:1 on the content surfaces.

### Type, spacing, shape, depth
| Scale | Values |
|---|---|
| Type (`--fs-*`) | 11, 12, 13, 14, 15, 17, 22 (the system font; one family, no serif) |
| Weights | 400, 500, 600, 700 |
| Spacing (padding and gap) | 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40 (1px hairlines allowed) |
| Radius | `--r-xs` 4, `--r-s` 8, `--r-m` 10, `--r-l` 12, `--r-xl` 16, pill, circle |
| Elevation | `--elev-1`, `--elev-2`, `--elev-3`, plus ink and overlay tokens |
| Gutter | `--gutter` 20px (the left margin of every pane); note text 900px and task list 1400px maximum, both left-aligned |

### Icons
One SVG registry (`ICONS`), 24 grid, 2px stroke, drawn in the text colour. Four sizes: 12 (chevrons, tiny marks), 14 (badges, chips), 16 (lists, sidebar, menus, icon buttons), 18 (toolbars). The right-click menus use the same drawings.

### Dialogs
`role="dialog"` (the destructive confirmation is an `alertdialog`), `aria-modal`, a name; one `closeModal` path; Cancel on the left and the primary action trailing; a destructive confirmation focuses Cancel; focus returns to the opener. Dismiss label is "Cancel" or "Done", never "Not now".

### Menus
Title-style labels, a 16px icon slot, "…" only where more input follows, no shortcut text in context menus except the ⌫ on Delete, unavailable commands dimmed (not hidden), danger items last.

### Interaction and input
- Arrow cursor on controls; hand only on links.
- Hit areas of at least 20×20 (most about 28) without changing the look.
- A visible focus ring on every control, with the note title and body keeping the caret.
- Keyboard: standard macOS shortcuts keep their meaning (⌘B/I/U, ⌘Z, ⌘A, ⌘P, ⌘K). Sidebar ⌥⌘S; Copy Note ⌃⌘C; table options Shift+F10; folder move ⌥↑ / ⌥↓.
- `prefers-reduced-motion`, `prefers-reduced-transparency` and `prefers-contrast` are all honoured.

### Appearance
"Match System" is on by default; Light | Dark stay visible and are dimmed while it is on. Text size has four steps (90 / 100 / 115 / 130%).

---

## 4. Open items and limits

- **F-07, F-17, F-36** are limits of being a web app (sheets, the system accent colour, a menu bar) and are left as they are.
- **F-16, F-28, F-33** are done with a deliberate remainder: status dots and the focus ring keep their own colours; row hovers keep `--bg-2`; about 36 component shadows stay as single-use definitions.
- **Not remapped on purpose:** the colours and sizes in the mail/clipboard export HTML (`noteToMailHtml`), the print rules, and the glyph sizes inside controls (tick marks, grips, small chevrons).

## 5. Needs a visual check

These could not be confirmed from code or headless screenshots:
1. **Secondary-text contrast on translucent Glass chrome** (sidebar, toolbars). It was calculated against flat surfaces only.
2. **The light theme overall.** Headless light-mode rendering was unreliable, so the light theme was judged by calculation, not by eye.
3. **The Notes editor toolbar with a note open**, for icon sizes and spacing.
4. **Hover states and the new keyboard routes** (Shift+F10 in tables, ⌥↑/⌥↓ on folders) with a real mouse and keyboard; they were tested by script.
5. **The native select pop-up lists** in Safari and Firefox, which follow `color-scheme` but could not be rendered headlessly.
