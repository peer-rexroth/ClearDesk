"""Design-rule checks that need a real browser (the JavaScriptCore suite in run.sh has no layout): icon sizes, hit areas, text contrast, page errors,
and, when the sibling ../Milestone folder exists, that every custom property both apps define has the same value in both themes
(cross-app audit X-30). Mirrors Milestone's tests/verify_design_rules.py.
Usage: python3 tests/browser-checks.py     (needs: pip install playwright pillow; it serves both folders itself)"""
import http.server, io, os, re, socketserver, sys, threading
from collections import Counter
from functools import partial
from playwright.sync_api import sync_playwright
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); CD = os.path.dirname(HERE); MS = os.path.join(os.path.dirname(CD), "Milestone")
results = []
def check(name, cond, detail=""):
    results.append(bool(cond)); print(("PASS  " if cond else "FAIL  ") + name + (f"   [{detail}]" if not cond and detail else ""))
def serve(root):
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    srv = socketserver.TCPServer(("127.0.0.1", 0), partial(Q, directory=root)); threading.Thread(target=srv.serve_forever, daemon=True).start(); return srv, srv.server_address[1]

# tokens whose values are allowed to differ, each with the reason (cross-app audit)
TOKEN_ALLOWED = {"--bar-bg": "Milestone writes the solid colour ClearDesk's translucent bar shows (X-05)"}
LUM = """c => { const m = c.match(/[\\d.]+/g).map(Number); const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]); }"""
INIT = "delete window.showOpenFilePicker; delete window.showSaveFilePicker; delete window.showDirectoryPicker"
ROLES = [("task title", ".task-list .task-title"), ("sidebar row", ".sidebar .nav-item:not(.active)"), ("sidebar active row", ".sidebar .nav-item.active"),
         ("sidebar section label", ".sidebar-section-label"), ("main title", "#mainTitle"), ("subtitle", "#mainSubtitle"), ("toolbar button", ".main-toolbar .btn")]

def open_page(b, port, theme="light"):
    ctx = b.new_context(viewport={"width": 1500, "height": 900}, color_scheme=theme); ctx.add_init_script(INIT)
    pg = ctx.new_page(); errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(f"http://127.0.0.1:{port}/"); pg.wait_for_timeout(500); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(700)
    pg.evaluate(f"document.documentElement.dataset.theme='{theme}'"); pg.wait_for_timeout(250)
    return ctx, pg, errors

srv_cd, p_cd = serve(CD)
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx, pg, errors = open_page(b, p_cd)
    pg.click("#quickAddInput"); pg.keyboard.type("Alpha"); pg.keyboard.press("Enter"); pg.wait_for_timeout(250); pg.keyboard.press("Escape"); pg.mouse.click(900, 600)
    ev = pg.evaluate
    off = ev("""() => [...document.querySelectorAll('i[class*="fa-"]')].filter(i => i.getBoundingClientRect().width).map(i => Math.round(parseFloat(getComputedStyle(i).fontSize) * 1.26 * 10) / 10).filter(d => ![12, 14, 16, 18].some(x => Math.abs(x - d) < .6))""")
    check("every visible icon is drawn at 12, 14, 16 or 18px", not off, off[:6])
    # DESIGN.md 4.1: every registry icon is outline only, draws inside the 3.5-20.5 box, and uses the documented strokes (2; zero-length dots; the heavier check;
    # a scaled <g transform> drawing with the stroke compensated). The one filled shape is the half disc of circle-half-stroke (In Progress).
    geo = ev("""() => { const bad = []; const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.style.cssText = 'position:fixed;left:0;top:0;width:24px;height:24px'; document.body.appendChild(svg);
      const OK = new Set(['path', 'circle', 'rect', 'ellipse', 'line', 'polyline', 'polygon', 'g']), FILL_OK = { 'circle-half-stroke': 1 }, WIDTH_OK = { 'check': 2.6 };
      for (const [k, v] of Object.entries(ICONS)) { svg.innerHTML = '<g>' + v + '</g>'; const root = svg.firstChild;
        for (const e of root.querySelectorAll('*')) { if (!OK.has(e.tagName.toLowerCase())) bad.push(k + ': tag ' + e.tagName);
          const f = e.getAttribute('fill'); if (f && f !== 'none' && !FILL_OK[k]) bad.push(k + ': fill ' + f);
          if (e.getAttribute('stroke')) bad.push(k + ': stroke attribute');
          const w = e.getAttribute('stroke-width'); if (w) { const d = (e.getAttribute('d') || '').replace(/\s/g, ''); const dot = /\.01/.test(d), inG = e.tagName.toLowerCase() === 'g'; if (parseFloat(w) !== 2 && !dot && !inG && parseFloat(w) !== WIDTH_OK[k]) bad.push(k + ': stroke-width ' + w); } }
        const bb = root.getBBox(); if (bb.x < 3.45 || bb.y < 3.45 || bb.x + bb.width > 20.55 || bb.y + bb.height > 20.55) bad.push(k + ': outside the 3.5-20.5 box ' + [bb.x, bb.y, bb.x + bb.width, bb.y + bb.height].map(n => +n.toFixed(2)).join(',')); }
      return bad; }""")
    check("every registry icon is outline only, inside the 3.5-20.5 box, with the documented strokes", not geo, geo[:6])
    src = open(os.path.join(CD, "index.html"), encoding="utf-8").read()
    grids = sorted({m for m in re.findall(r'<svg[^>]*viewBox=["\']0 0 (\d+ \d+)["\']', src)} - {"24 24", "10 14", "10 6", "10 10"})
    check("no hand-drawn svg on another grid than 24 (the 10-grid pull-down chevrons are the one documented exception)", not grids, grids)
    small = ev("""() => [...document.querySelectorAll('.sidebar button, .sidebar .nav-item, .main-toolbar button, .main-toolbar select')].filter(e => e.offsetParent).map(e => [e.id || e.className.toString().slice(0, 28), Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)]).filter(a => a[1] < 20 || a[2] < 20)""")
    check("sidebar and toolbar controls are at least 20x20", not small, small[:6])
    for theme in ("light", "dark"):
        ev(f"document.documentElement.dataset.theme='{theme}'"); pg.wait_for_timeout(350)
        shot = Image.open(io.BytesIO(pg.screenshot())).convert("RGB"); bad = []
        for label, sel in ROLES:
            r = ev("""s => { const e = [...document.querySelectorAll(s)].find(e => e.getBoundingClientRect().width > 0); if (!e) return null; const r = e.getBoundingClientRect(); return { color: getComputedStyle(e).color, x: r.left + 3, y: r.top + 3, w: r.width, h: r.height }; }""", sel)
            if not r: bad.append((label, "missing")); continue
            box = shot.crop((int(r["x"]) - 3, int(r["y"]) - 3, int(r["x"]) + int(r["w"]) - 3, int(r["y"]) + int(r["h"]) - 3)); bg = "rgb(%d,%d,%d)" % Counter(box.getdata()).most_common(1)[0][0]
            l1, l2 = ev(LUM, r["color"]), ev(LUM, bg); ratio = (max(l1, l2) + .05) / (min(l1, l2) + .05)
            if ratio < 4.5: bad.append((label, round(ratio, 2), r["color"], bg))
        check(f"[{theme}] text contrast >= 4.5:1 for the main roles", not bad, bad)
    metas = ev("""() => { setThemeMode('dark'); const d = [...document.querySelectorAll('meta[name="theme-color"]')].map(m => m.content); setThemeMode('light'); const l = [...document.querySelectorAll('meta[name="theme-color"]')].map(m => m.content); return [d, l]; }""")
    check("both theme-color metas follow the chosen theme", metas[0] == ["#26272c"] * 2 and metas[1] == ["#f5f6f9"] * 2, metas)
    check("no page errors", not errors, errors[:3]); ctx.close()

    if os.path.isdir(MS):
        srv_ms, p_ms = serve(MS); vals = {}
        for app, port, root in (("cd", p_cd, CD), ("ms", p_ms, MS)):
            names = sorted(set(re.findall(r"(--[a-zA-Z][\w-]*)\s*:", open(os.path.join(root, "index.html"), encoding="utf-8").read())))
            for theme in ("light", "dark"):
                c2, pg2, _ = open_page(b, port, theme)
                vals[(app, theme)] = pg2.evaluate("names => { const c = getComputedStyle(document.documentElement); return Object.fromEntries(names.map(n => [n, c.getPropertyValue(n).trim()])); }", names); c2.close()
        for theme in ("light", "dark"):
            a, m = vals[("cd", theme)], vals[("ms", theme)]
            diff = [(k, a[k][:40], m[k][:40]) for k in a if a[k] and m.get(k) and a[k] != m[k] and k not in TOKEN_ALLOWED]
            check(f"[{theme}] a token both apps define has the same value in both", not diff, diff)
    else:
        print("SKIP  token agreement (no ../Milestone folder)")
    b.close()
n_ok, n_all = sum(results), len(results); print(f"\n{n_ok}/{n_all} checks passed"); sys.exit(0 if n_ok == n_all else 1)
