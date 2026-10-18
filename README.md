# MyDesk

A local-first task and notes manager — projects, priorities, due dates, subtasks and
recurring tasks — that runs entirely in your browser and stores everything
on your own device. No account, no server, no tracking.

- **List view** and **Kanban board view** (grouped by project)
- Projects, tags, priorities, due dates
- Subtasks with one level of nested steps
- Recurring tasks (daily/weekly/monthly/yearly, with an end date or a max
  number of occurrences)
- Installable as a PWA, with offline support
- Data lives in your browser's `localStorage` by default; optionally link a
  local `.json` file to sync across browser profiles (Chrome/Edge only)
- JSON export/import for backups or moving data around

## Running it

Clone the repo, then from inside it:

```
./start-mydesk.command
```

This serves the folder on `http://127.0.0.1:8934` and opens it in Chrome or
Edge (Safari can't install this kind of PWA on macOS). `./stop-mydesk.command`
stops the server again.

You can also just open `mydesk.html` directly in a browser (`file://`) for a
quick look, but installing the PWA and offline support both require the app
to be served over `http://` rather than opened as a bare file.

Once it's open, click the install icon in the browser's address bar (or
Chrome/Edge's menu → "Install mydesk…") to install it as a standalone app.

## No build step

Everything — HTML, CSS, and JS — lives in the single `mydesk.html` file.
There's no bundler, no package manager, and no dependencies beyond a CDN
Font Awesome stylesheet. Open the file in an editor and change it directly.

## Tests

```
./tests/run.sh
```

See [CLAUDE.md](CLAUDE.md) for how the test harness works and the app's data
model, if you're digging into the code.

## License

MIT — see [LICENSE](LICENSE).
