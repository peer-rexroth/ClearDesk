# ClearDesk

A local-first workspace for tasks, notes and reusable prompts — projects, due dates,
rich notes, and prompt templates with variables — that runs entirely in your browser
and stores everything on your own device. No account, no server, no tracking.

- **Tasks**: list view and Kanban board (grouped by project or status), projects, tags,
  priorities, due dates, and subtasks nested four levels deep
- **Notes**: rich text, checklists, tables, folders, pinning, locking, Markdown in and out
- **Prompts**: reusable templates with choices, checklists, text and shared global variables
- Recurring tasks (daily/weekly/monthly/yearly, with an end date or a max
  number of occurrences)
- Installable as a PWA, with offline support
- Data lives in your browser's `localStorage` by default; optionally link a
  local `.json` file to sync across browser profiles (Chrome/Edge only)
- JSON export/import for backups or moving data around, a daily file backup into the linked
  folder, and notes/prompts files you can share

## Running it

Clone the repo, then from inside it:

```
./start-cleardesk.command
```

This serves the folder on `http://127.0.0.1:8934` and opens it in Chrome or
Edge (Safari can't install this kind of PWA on macOS). `./stop-cleardesk.command`
stops the server again.

You can also just open `index.html` directly in a browser (`file://`) for a
quick look, but installing the PWA and offline support both require the app
to be served over `http://` rather than opened as a bare file.

Once it's open, click the install icon in the browser's address bar (or
Chrome/Edge's menu → "Install ClearDesk…") to install it as a standalone app.

## Publishing (Cloudflare Pages)

The app is plain static files, so any static host works. For Cloudflare Pages: connect the repo, leave the framework preset empty, set the build command to `./build-site.sh` and the output directory to `dist`. `_headers` (copied into `dist`) makes the page and service worker revalidate on every visit, so a new deploy shows up as the "new version" notice. Data lives in each browser per address, so a new address starts empty: Export on the old one, Import on the new one.

## No build step

Everything — HTML, CSS, and JS — lives in the single `index.html` file.
There's no bundler, no package manager, and no dependencies (no CDN either; the icons are inline). Open the file in an editor and change it directly.

## Tests

```
./tests/run.sh
```

See [CLAUDE.md](CLAUDE.md) for how the test harness works and the app's data
model, if you're digging into the code.

## License

Copyright © 2026 Peer Rexroth. All rights reserved — see [LICENSE](LICENSE).
