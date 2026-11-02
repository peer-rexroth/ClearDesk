# ClearDesk and Milestone: cross-app alignment audit

Audited 2026-11-01 against `/Users/peer/Documents/Dev/ClearDesk` and `/Users/peer/Documents/Dev/Milestone` (working trees as found; `index.html` 12,754 and 15,109 lines). Read-only: the only file written is this report; scan scripts, measurements and screenshots live outside both projects. Nothing was committed.

Line references are to the `index.html` of the app named in the column, unless a file is given. "Measured" means computed style in headless Chrome (Playwright), light and dark, at 1500 and 900 px, each app served on its own port. "Code" means read from source only.

Two notes on the brief:

- **Finding ids.** ClearDesk's audit uses `W-nn`; Milestone's uses `M-nn` (not `V-nn`; ClearDesk's tests still cite an older `V-nn` series). I refer to them as W- and M-. A finding already in one of them is only cited, never repeated.
- **Reference rule.** ClearDesk wins for look, components, menus, wording and keyboard behaviour; Milestone wins for what exists only in it. Where ClearDesk is itself wrong (X-20, X-23), the row says so.

---

## Status (2026-11-02)

All rows are built, decided or closed; the verdicts in the table below are as audited. Both suites pass (ClearDesk 487, Milestone 130 / 130) and `tests/browser-checks.py` passes 8 / 8.

| Rows | Outcome |
|---|---|
| X-01, X-02, X-03, X-04 | Built in Milestone (dark accent, flat `--glass-accent`, `--shadow` meaning, greens). |
| X-05, X-17, X-18, X-19 | Deliberate, unchanged. |
| X-06 | Resolved by behaviour, not tokens: the inactive selection band measures the same in both apps; Milestone's inactive row kept white text on the grey band (`.grid-row.selected { color }` was not guarded), now fixed. Milestone keeps its own selection tokens. |
| X-07 | Built: the six legacy aliases are gone (366 uses replaced), in the app, `tokens.css`, DESIGN.md and tests. |
| X-08, X-11 | Built (15 px base text; glass menus). Line-height left at its old value: 1.5 made menu items 37 px instead of 33. |
| X-09 | Partly built: dialog scrim 200, toast 300, menu 400 (`#cfAddMenu` moved with them). The remaining odd values (M-19) are unchanged. |
| X-10 | The five literal `.12s` now use `var(--dur-fast)`. The 0.2 s on ClearDesk's sidebar and dialog box is a generic rule (W-03), not a design value, so Milestone did not copy it. |
| X-12 | Built: class map in both DESIGN.md files. |
| X-13, X-14, X-15, X-16, X-22, X-24, X-26, X-32 | Built in Milestone; toast and update banner now measure identical to ClearDesk's. |
| X-20, X-21, X-23, X-27, X-29 | Built in ClearDesk. |
| X-25 | No change needed: every call passes a title ("Confirm" is never shown). Two lower-case titles ("Unlink file", "Delete plan") were set to title style. |
| X-28 | Built in both (`#f5f6f9` / `#26272c`; ClearDesk now also updates the metas when the theme is forced). |
| X-30 | Built: `tests/browser-checks.py` in ClearDesk; Milestone's rules test gained the `transition: all`, var-fallback and undefined-token scans, and an exact list of colour literals instead of the cap of 36. |
| X-31 | Built: sync line and the shared rules in Milestone's DESIGN.md. |
| Extra | Help window in Milestone matches ClearDesk's: uppercase captions, "Search" placeholder, 36 px field, 236 px rail, 12 px submenu chevrons. Both Help and Shortcuts now open with focus in the search box (Milestone's M-05 behaviour, built in ClearDesk; DESIGN.md updated in both). |
| Extra | `dayStr(d)` added to Milestone; ClearDesk's `todayStr()` no longer uses UTC. Two Milestone tests that built dates in UTC were date-proofed. |
| Extra | Dialogs in Milestone also get the glass blur and rim (same cause as X-11: the flat content scope). |

---

## 1. Summary

**How aligned.** Closer than two hand-built apps usually are, and closer in the data than in the feel. The plumbing is almost identical (`_headers`, `build-site.sh`, `robots.txt` byte-identical; `wrangler.jsonc`, `release.yml` and `sw.js` differ only by name and comments). The 116 icon names the apps share are drawn identically (string compare of every drawing). The colour, radius, spacing and motion tokens agree on name and, with five exceptions, on value. The two apps still feel different because of a handful of things the eye reads before any token: **body text is 15 px in ClearDesk and 14 px in Milestone, menus are glass in one and flat in the other, the toast and the update banner are built differently, and the primary colour is a different blue in dark with a gradient on the buttons.** Nothing here is broken; all of it is cheap except the font-size change.

**The five that matter most**

1. **X-08 (High):** base text size. ClearDesk 15 px (`index.html:204`), Milestone 14 px (`index.html:544`). Every menu, dialog, sidebar row and banner inherits it. Menus, sidebars and dialogs measure 15 vs 14 px, and Milestone leans harder on the 11 and 12 px steps (45 + 129 uses against 27 + 61).
2. **X-11 (High):** context and pull-down menus. ClearDesk's are glass (97 % surface, 26–28 px blur, inset highlight, `z-index` 400); Milestone's are opaque and flat (no blur, `z-index` 80). Same size (230 px), same hover blue, different material.
3. **X-20 (Medium, ClearDesk bug, Milestone is right):** ClearDesk's `todayStr()` is UTC (`toISOString().slice(0,10)`); Milestone's is local. In ClearDesk, Overdue, My Day, the due-date presets and the daily backup name flip to the new day one or two hours late east of Greenwich (code, not run).
4. **X-01 / X-02 / X-03 (Medium):** the primary blue. Dark `--accent` is `#2c62c9` in ClearDesk and `#2a5fcf` in Milestone (it has no dark override, so its own DESIGN.md is wrong); `--glass-accent` is a flat fill in ClearDesk and a gradient in Milestone; `--shadow` means "resting button shadow" in one and "elevation 2" in the other.
5. **X-14 / X-15 (Medium):** the toast (padding 10/16 vs 10/14, gap 8 vs 14, radius 16 vs 12, weight 500 vs 400, check icon vs none, Undo bold-underlined in text colour vs blue) and the update banner (glass, spanning the whole window including over the sidebar vs a solid strip inside the content area only).

**Count by verdict (32 rows)**

| Verdict | Rows |
|---|---|
| Align to ClearDesk | 20 |
| Align to Milestone | 3 (X-20, X-21, X-29) |
| Deliberate (reason stated) | 5 (X-05, X-12, X-17, X-18, X-19) |
| Neither is the reference: one recommended | 4 (X-23, X-27, X-28, X-30) |

By severity: High 2, Medium 12, Low 18. By app that needs the change: Milestone 20, ClearDesk 5, both 3, none (deliberate) 4.

**Checked and found aligned** (no row): Help menu (four items, same order, same labels); "Check for Updates" and the update copy ("A new version of **X** is ready." / "X is up to date" / "Could not reach the server to check for updates"); the `BUILD_ID` + `version.json` update check and `build-site.sh`; backup file naming (`<file>-YYYY-MM-DD.json` in a `Backups` folder; `<app>-backup-before-replace-<date>.json`); confirm and Import dialog metrics (340 and 400 wide, padding 24/24/20, gap 12, radius 16, `alertdialog`); About dialog (320 wide, padding 40/28/24); Esc closes About, Help, Shortcuts and a context menu in both (measured); sidebar maximum (480), radius ladder, `--dur-fast` / `--dur-base`, `cursor: default` everywhere, no `transition: all` in either.

---

## 2. Alignment table

Sev = severity (H/M/L). Eff = effort (S/M/L). Change = the app that needs the edit.

### Tokens

| ID | Area | What | ClearDesk | Milestone | Verdict | Sev | Eff | Change |
|---|---|---|---|---|---|---|---|---|
| X-01 | Colour | Dark accent (selection, primary button, links) | `--accent: #2c62c9`, and `--sel-bg`, `--accent-tint` follow (`design-system/tokens.css` dark block; measured) | No dark override: `#2a5fcf` in both themes (measured). Its DESIGN.md §2.1 still says dark `#2c62c9`, so the doc is wrong for Milestone | Align to ClearDesk | M | S | Milestone |
| X-02 | Colour | `--glass-accent` (primary button fill) | `var(--accent)`, "a flat fill, no gradient" (`tokens.css`) | `linear-gradient(180deg, color-mix(accent 90%, #fff), accent)` (`tokens.css`, measured) | Align to ClearDesk | M | S | Milestone |
| X-03 | Elevation | `--shadow` is one name with two meanings | Resting button shadow `0 1px 2px … , 0 4px 16px …` (dark `0 6px 20px`) | Alias of `--elev-2`: `0 6px 18px rgba(0,0,0,.14)` (measured) | Align to ClearDesk: give Milestone's panel shadow its own use of `--elev-2` and keep `--shadow` for buttons | M | M | Milestone |
| X-04 | Colour | Green text tokens (light) | `--green-text #17722f`, `--nc-green #1a7f37` | `--green-text #1a7a36`, `--nc-green #1a7a36` (measured, light only) | Align to ClearDesk (Milestone's `--task-green` bar colour is its own and stays) | L | S | Milestone |
| X-05 | Colour | Toolbar surface `--bar-bg` / `--bar-line` | Translucent: `rgba(244,245,248,.92)`; dark `rgba(255,255,255,.04)` | Solid `#f5f6f9` / `#26272c` plus an extra `--bar-line` (`tokens.css:291–302`, comment says they are ClearDesk's measured result) | Deliberate: Milestone documents these as the colours ClearDesk's bar shows over its wallpaper. Re-measure whenever ClearDesk's bar changes; see section 5 | L | S | — |
| X-06 | Colour | Selection / pill tokens that ClearDesk has and Milestone lacks | `--on-green`, `--sel-band`, `--sel-pill`, `--pill-plate`, `--sel-grey-mix`, `--sel-sub-tint`, `--sel-sub-grey` (measured: only in ClearDesk). Also `--diff-*`, `--find-*`, `--bar-ctl-h` (notes / prompts only, correctly absent) | None of the seven; Milestone mentions `sel-inactive` 24 times against ClearDesk's 41, so it has its own inactive-selection logic | Align to ClearDesk for the selection set (grey inactive band, pill plate, tick on green) so the two selections match; I did not measure Milestone's inactive selection, see section 5 | M | M | Milestone |
| X-07 | Tokens | Milestone's legacy alias names | None | `--panel` (66 uses), `--panel-2` (36), `--text-dim` (125), `--text-faint` (133), `--page-bg` (3), `--primary` (3); each is an alias of `--bg`, `--bg-2`, `--text-2`, `--text-3`, `--bg-2`, `--accent` (`tokens.css:304–313`) | Align to ClearDesk: replace the 366 uses by the ClearDesk name, then delete the aliases. Pure search and replace, no visual change | L | M | Milestone |
| X-08 | Typography | Base text size, which menus, dialogs, sidebar and banners inherit | `body { font-size: var(--fs-15) }` (`:204`, `:681`); measured sidebar, menu, dialog 15 px / line-height 22.5 | `body { font-size: var(--fs-14) }` (`:544`); measured 14 px, `line-height: normal` | Align to ClearDesk for chrome (sidebar, menus, dialogs, toast, banners). Deliberate for the task grid, Gantt and Resource Sheet: they stay at 13/12 px because the row height (`--row-h` 32 px) is the constraint. Set the line-height too (1.5), Milestone has none | H | M | Milestone |
| X-09 | z-index | Same layers, different numbers | Float sidebar 140, dialog scrim 200, toast 300, row menu 400 (`:854`, `:1040`; measured) | Sidebar 60, row menu 80, dialog scrim 100, toast 200, plus 9998 / 9999 (see M-19) | Align to ClearDesk: scrim 200, toast 300, menu 400 (a menu at 80 sits below a dialog at 100 and relies on every popup having its own override) | M | M | Milestone |
| X-10 | Motion | Literal durations and sidebar animation | Only `--dur-fast` (41) and `--dur-base` (23); sidebar and dialogs animate 0.2 s (measured) | `--dur-fast` (13), `--dur-base` (2) and five literal `.12s`; sidebar and dialogs measured 0 s (no transition) | Align to ClearDesk: `.12s` to `var(--dur-fast)`; give the sidebar collapse and the dialog open the 0.2 s fade. Check visually, see section 5 | L | S | Milestone |

### Components

| ID | Area | What | ClearDesk | Milestone | Verdict | Sev | Eff | Change |
|---|---|---|---|---|---|---|---|---|
| X-11 | Menu | Material of context and pull-down menus | `.row-menu` (`:854`): `rgba(255,255,255,.97)` surface, `blur(26px)` (dark 28), inset highlight, border `rgba(255,255,255,.6)`, `z-index` 400 (measured) | `.dropdown-menu` (`:701`): opaque `#fff`, `backdrop-filter: none`, border `rgba(40,44,70,.16)`, no inset highlight, `z-index` 80 (measured). `tokens.css:125–129` carries special border overrides for it | Align to ClearDesk: give `.dropdown-menu` the glass surface the way `:is(.row-menu, .modal, .toast)` gets it (`:996–997`) and drop the border overrides | H | S | Milestone |
| X-12 | Menu | Two class systems for the same thing | `.row-menu` / `.row-menu-item` (context), `.split-btn-menu` / `-item` (button menus) | `.dropdown-menu` / `.dropdown-item` for both | Deliberate: class names are internal. Rename nothing; write the mapping into both DESIGN.md files so a port knows `.dropdown-item` = `.row-menu-item` | L | S | both (docs) |
| X-13 | Menu | Shortcut hint of Delete | `⌫` glyph (measured, menu text "Delete ⌫") | the word "Del" | Align to ClearDesk | L | S | Milestone |
| X-14 | Toast | Shape, weight, Undo link, icon | `#toast` (`:627`, glass at `:996`): padding 10/16, gap 8, radius 16, weight 500, `z-index` 300, check icon, Undo bold and underlined in text colour; at bottom 24 / right 24 | `#toast` (`:2212`): padding 10/14, gap 14, radius 12, weight 400, `z-index` 200, no icon, Undo in accent colour 600; at bottom 44 / right 20 (clears the status bar, so the offset is deliberate) | Align to ClearDesk for everything except the 44 px bottom offset (status bar). The Undo link in `--accent` is also 2.58:1 in dark on glass (the M-01 class); ClearDesk's text-colour Undo has no such risk | M | S | Milestone |
| X-15 | Banner | The update banner | `.update-banner`: glass `rgba(255,255,255,.46)` + `blur(26px)`, spans the full window (measured 1500 wide, over the sidebar), accent icon | `.update-banner` (`:1424`): solid `--panel-2` / `rgb(38,39,45)`, no blur, spans the content area only (1232 of 1500), grey text | Align to ClearDesk: glass surface and the accent icon; full-width placement is a layout change in Milestone (the banner lives inside `.content`, `:2388`) so keep it where it is unless the sidebar is moved under it. Measured on an empty banner, so heights are not comparable | M | S | Milestone |
| X-16 | Dialog | Help and Shortcuts window size | 860 × 700 (measured at 1500; 846 at 900) | 840 × 690 | Align to ClearDesk | L | S | Milestone |
| X-17 | Dialog | Sheet structure | One box: `.modal` padding 24, gap 16, `.modal-actions` row (380 / 420 wide) | Three bars (header, body, footer) with hairlines, padding on the parts (`pad 0`), 440–1040 wide | Deliberate: Milestone's forms are tall and scroll, so the header and footer stay put. The inner gutters must still be 24 px; see M-18 for the doc gap. Measure the gutters, section 5 | M | — | — |
| X-18 | Sidebar | Width and where it floats | 300 default, 260–480, floats at or below 1100 px (`:2980`, `:1037`, `:3058`) | 268 default and minimum, max 480, docks down to 800 px (`:14725`, `:14754`) | Deliberate: each minimum is the widest the tool row needs (both code comments say so), and Milestone's toolbar has a "More" overflow. M-16 covers the doc | M | — | — |
| X-19 | First run | Linking storage | A dismissible banner: "Your data is only saved in this browser. Link a file to back it up." | A blocking dialog, "Welcome to Milestone", no Esc, no scrim close (M-20) | Deliberate: Milestone keeps plans only as files in a folder; ClearDesk also works from browser storage | L | — | — |
| X-32 | Empty state | Container metrics | `.empty-state`: flex, gap 10, padding 20/20/60, text `rgba(21,22,27,.62)`, weight 400 (measured) | block, padding 60/24, text `rgba(21,22,27,.74)`, weight 600 (measured); also a second line, "Choose Add Task to start planning." | Align to ClearDesk for colour and weight; the extra hint line is fine (it names an action) | L | S | Milestone |

### Behaviour and wording

| ID | Area | What | ClearDesk | Milestone | Verdict | Sev | Eff | Change |
|---|---|---|---|---|---|---|---|---|
| X-20 | Dates | "Today" for the due logic and for file names | `todayStr()` is UTC: `new Date().toISOString().slice(0,10)` (`:3514`), used 18 times: `isOverdue` (`:3589`), My Day count (`:3646`), due presets, and the `cleardesk-<date>.json` export names (`:12045`, `:12272`) | `todayStr()` is local: `${getFullYear()}-${pad2(month)}-${pad2(day)}` (`:3816`) | Align to Milestone. East of UTC (a UTC+1 or UTC+2 clock) between local midnight and 01:00 or 02:00 "today" is still yesterday: My Day lists yesterday's tasks, a task due yesterday is not yet overdue, and the "first change each day" backup is keyed to the wrong day. Read from code, not reproduced | M | S | ClearDesk |
| X-21 | Backup | Name of the daily backup folder in the Help text | Help says "a `Backup` folder" (`:2786`); the comments at `:12387` and `:12568` say "Backup"; the code writes `Backups` (`FILE_BACKUP_SUB`, `:12571`) | `Backups` in text and code (`:3442`, `:14132`) | Align to Milestone: the text is wrong, the code is right | L | S | ClearDesk |
| X-22 | Dialog | Order of the Import buttons | Cancel · Replace · Merge | Cancel · Merge · Replace | Align to ClearDesk (already known as M-06 on the Milestone side; the point here is that it is the one place the two apps disagree in a visible button row) | L | S | Milestone |
| X-23 | Wording | "Keyboard shortcuts" casing | The window title and its button in Help read "Keyboard shortcuts"; the Help menu item reads "Keyboard Shortcuts" (`:2243`) | "Keyboard Shortcuts" everywhere | Neither: ClearDesk contradicts its own §8 ("title-style capitalisation for menu items, buttons and sheet titles"). Recommend title style in both: change ClearDesk's window title and button | L | S | ClearDesk |
| X-24 | Wording | Sentence-case buttons and titles | Title style: "Sync to a File", "Name the New File", "Projects Shown" | Mixed: "Replace all", "Dismiss all", "Choose a folder to continue", "Days off" against "Copy Picture", "Level Resources", "Changes Made on Both Sides" | Align to ClearDesk (§8): "Replace All", "Dismiss All", "Choose a Folder to Continue", "Days Off" | L | S | Milestone |
| X-25 | Wording | Title of the confirm dialog | Per call: "Delete?" | Static markup default is "Confirm" (`#confirmModalBg`); whether each call overrides it was not checked | Align to ClearDesk: name the action in the title. Verify first, section 5 | L | S | Milestone |
| X-26 | Wording | Toast verbs for the same event | "Task duplicated", "Task restored", "Subtask deleted" | "Duplicated", "Plan restored", `Deleted “<name>”` | Align to ClearDesk: noun + past-tense verb ("Task duplicated"); keep the name where it adds information | L | S | Milestone |
| X-27 | Wording | A refused permission | "Permission denied" | "Permission not granted" | Neither: dismissing the prompt is not a denial, so "Permission not granted" is the accurate one. Recommend it for both. The "requires Chrome or Edge" lines name different features ("File linking" / "Opening a plan from a folder") and stay different | L | S | ClearDesk |
| X-28 | PWA | Colour of the browser frame | `theme-color` `#ffffff` light / `#1e1f24` dark (`:8–9`), manifest `#ffffff` | `#f2f3f7` light / `#171925` dark (`:15–16`, rewritten at `:10788`), manifest `#f2f3f7` | Neither: each should equal the colour of its own top chrome. ClearDesk's `#1e1f24` is not a token of its own (its dark `--bg-2` is `#171925`). Compare with the actual title area, section 5; M-15 is the Milestone side | L | S | both |
| X-29 | PWA | `sw.js` | Same logic. `cleardesk-cache-v4`; the precache list has no `icons/icon.svg`; no comment on the error-page rule | `milestone-cache-v8`; adds `icons/icon.svg`; carries the comment "an error page must not replace the good saved copy" | Align to Milestone: add the comment (the code line is already identical). Add `icon.svg` only if ClearDesk loads it | L | S | ClearDesk |

### Docs and tests

| ID | Area | What | ClearDesk | Milestone | Verdict | Sev | Eff | Change |
|---|---|---|---|---|---|---|---|---|
| X-30 | Tests | Rules enforced | `tests/cases/tokens.test.js`, 7 scans: no `cursor: pointer` off links; no `transition: all`; no `var(--x, #hex)` fallback; every `var()` is defined; every font-size is a token; every radius is a token or listed; **zero** colour literals outside token definitions. Runs in JavaScriptCore, so no layout | `tests/verify_design_rules.py`: exactly one `cursor: pointer` rule; no px font sizes; radii; colour literals **capped at 36** (a ratchet, not zero); FA CDN gone; icon sizes 12/14/16/18; text contrast ≥ 4.5; hit area ≥ 20 px; no page errors. No `transition: all`, no fallback and no undefined-token scan | Neither: each lacks what the other has. Share the list in section 4 | M | M | both |
| X-31 | Docs | The two DESIGN.md files have forked | 673 lines, ClearDesk only | 742 lines: the same text plus a Milestone decisions table and a chapter 21; 113 lines differ | Align to ClearDesk as the base: the shared chapters (§1–§20) should differ only where Milestone's table says so. Today a ClearDesk change reaches Milestone only if someone remembers. Add a "synced with ClearDesk DESIGN.md at commit …" line to Milestone and re-diff on each ClearDesk change. The wrong dark-accent value (X-01) is the first symptom | M | S | Milestone |

---

## 3. Fix list by app

Ordered by value over effort. Each item cites its row.

### Milestone

1. **Menus get the glass surface** (X-11) and the `⌫` hint (X-13). One rule, the largest visible change per line.
2. **Dark accent, button fill, shadow meaning** (X-01, X-02, X-03). Remove nothing: add `--accent: #2c62c9` in the dark block, set `--glass-accent: var(--accent)`, and rename the use of `--shadow` that means elevation. Regenerate `tokens.css` (it says not to edit it by hand).
3. **Toast and update banner** (X-14, X-15), **Help / Shortcuts window size** (X-16), **empty state** (X-32).
4. **Wording sweep** (X-22, X-24, X-25, X-26): about ten strings.
5. **Green tokens** (X-04) and **`.12s` to `var(--dur-fast)`** (X-10).
6. **Body text 15 px for chrome** (X-08). Do it after 1–5, then check the toolbar, sidebar and status bar still fit at 900 px; the grid and Gantt keep their own sizes.
7. **z-index scale** (X-09), together with the M-19 clean-up of the 23 values.
8. **Selection tokens** (X-06), then **alias retirement** (X-07, 366 mechanical replacements; do it last so a stale alias cannot hide a real token mismatch).
9. **DESIGN.md sync header** (X-31) and the text fix in section 4.

### ClearDesk

1. **`todayStr()` to local time** (X-20): use Milestone's function (`index.html:3816`) at `:3514`, and use it for the export names at `:12045`, `:12272`. Add a test that sets the clock to 23:30 UTC and 00:30 local.
2. **Help text says `Backups`** (X-21): `:2786`, comments `:12387`, `:12568`.
3. **"Keyboard shortcuts" to title style** (X-23); **"Permission not granted"** (X-27).
4. **`sw.js` comment** (X-29).
5. **Theme colours** (X-28) after the visual check.
6. Add the tests marked "ClearDesk" in section 4 (X-30).

---

## 4. Proposed additions

### DESIGN.md (both)

Paste into both files, in §2 (tokens) or the closing chapter:

> **Two apps, one system.** ClearDesk is the reference for look, components, menus, wording and keyboard behaviour; Milestone for the planner only (Gantt, scheduling, columns, task dialog). The two files share §1–§20. A change to a shared chapter is made in ClearDesk first and copied by hand; Milestone's file starts with "synced with ClearDesk DESIGN.md at commit …".
>
> **Same name, same value.** A token that exists in both apps has the same value in both, in both themes. A token that only one app needs is listed under that app's chapter, not in the shared table.
>
> **Surfaces.** Menus, dialogs, toasts and the update banner use the glass surface (`--glass-strong`, `--glass-blur`, inset highlight). Layers: float sidebar 140, dialog scrim 200, toast 300, menu 400.
>
> **Base size.** 15 px for chrome (sidebar, menus, dialogs, toast, banners). Dense data (task grid, Gantt, resource sheet) is the one deliberate exception and uses the `--fs-12` / `--fs-13` steps.
>
> **Today.** "Today" is the local calendar day, never `toISOString()`.
>
> **Menu class map.** `.row-menu` (ClearDesk) = `.dropdown-menu` (Milestone); `.row-menu-item` = `.dropdown-item`; `.split-btn-menu` = `.dropdown-menu` opened from a button.

ClearDesk's file also needs: the daily backup folder is `Backups` (X-21). Milestone's needs: §2.1 dark accent corrected (X-01), and the sheet gutters stated as 24 px (X-17).

### Checks both suites should share

Seven rules. The first five are static scans of the stylesheet and work in both runners (ClearDesk's JavaScriptCore harness, Milestone's Playwright); the last two need a browser or both files.

| Rule | In ClearDesk | In Milestone |
|---|---|---|
| No `cursor: pointer` except on links | yes | yes (exactly one rule: tighten ClearDesk to the same form) |
| No `transition: all` | yes | **add** |
| No `var(--x, <colour literal>)` fallback | yes | **add** |
| Every `var(--x)` read is defined | yes | **add** |
| Every font-size, radius is a token or listed; colour literals outside token definitions: zero, with a written exception list | zero | **replace the cap of 36 by a list of the known literals**, so a new one fails instead of being absorbed |
| Icon sizes 12/14/16/18, hit area ≥ 20 px, contrast ≥ 4.5, no page errors | **add** (Playwright script under `tests/`, no new dependency in the app) | yes |
| Same-name tokens agree: read both `tokens.css` files and fail on a differing value of a shared name | **add** (needs both files) | **add** |

The last row would have caught X-01, X-02, X-03 and X-04. It needs only the two `tokens.css` files, so it can run from either repo with a hard-coded sibling path.

---

## 5. Needs a visual check, and skipped areas

**Could not verify, or only partly**

- **X-02.** Which elements use `--glass-accent`. If only primary buttons, the gradient is visible there; if the Gantt bars use it too, aligning needs a Milestone-only token.
- **X-05, X-28.** The toolbar and theme-colour values were taken from computed style and meta tags, not compared against the actual window title area or the installed PWA frame.
- **X-06.** Milestone's inactive (grey) selection. I confirmed which tokens exist, not how the selected row looks when the window is inactive. Compare both with the window not focused.
- **X-10.** Milestone shows no transition on the sidebar and dialogs (0 s measured); I did not watch a collapse or a dialog open.
- **X-15.** The update banner was measured with its class set by hand and no content, so backgrounds and widths are real but heights are not. Show the real banner (publish a changed `version.json` to a served copy) and compare.
- **X-17.** The 24 px gutters inside Milestone's header, body and footer bars.
- **X-25.** Whether each Milestone confirm call sets its own title.
- **Help search field.** In the screenshots ClearDesk shows a "Search" capsule and Milestone a focused "Search help…" field with a ring; I did not decide which is right.
- **Font sizes in ClearDesk.** My scan found literal `font-size` values of 12, 13, 14, 15, 16, 17, 20 and 22 px in ClearDesk's `index.html`, outside the 16 px its test allows. They may sit in template strings or the print sheet, where the test does not look; I did not trace them.
- **tokens.css against the app.** Not diffed for either app (ClearDesk defines most tokens on lines that begin with more than one declaration, so a simple scan undercounts). Relevant because Milestone says its file is regenerated.
- **Weights.** Milestone uses 600 in 84 declarations and 700 in 9; ClearDesk 600 in 47 and 700 in 21. Dialog and window titles are probably where this shows (W-13); not measured per element.

**Skipped, and why**

- **Tooltips, focus rings, scrollbars, popovers other than menus, the find bar.** Not measured. The find bar exists only in ClearDesk's notes; Milestone's Find and Replace is a dialog for tasks, a different feature, so neither is a difference. Tooltip length is M-14 and W-04.
- **Tab / Enter behaviour.** Only Esc was tested (closes About, Help, Shortcuts and a context menu in both). Tab handling is W-01 and W-02 on the ClearDesk side and not compared.
- **Selection colours in the active state.** Same blue (see X-01 for the dark difference); the grey state is in X-06.
- **Gantt, scheduling, columns, task dialog, Resource Sheet, notes and prompts.** Out of scope by the rules of the brief.
- **Screenshots.** Taken for both apps at 1500 and 900 px in both themes; I read the light 1500 px pair and the dark pairs for the menu, toast and Help window. The 900 px pairs were compared numerically (sidebar, toast, banner, Help sizes) and not by eye.
