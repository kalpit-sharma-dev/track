#!/usr/bin/env python3
"""Serve the tracker and store notes in tracker-data.json beside this file."""

import argparse
import json
import os
import shutil
import subprocess
import tempfile
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "tracker-data.json"
TEMP_FILE = ROOT / "tracker-data.json.tmp"


class TrackerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?", 1)[0] != "/api/data":
            return super().do_GET()
        if not DATA_FILE.exists():
            self.send_response(204)
            self.end_headers()
            return
        body = DATA_FILE.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/report.pdf":
            self.export_report_pdf()
            return
        if path != "/api/data":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_error(400, "Invalid JSON")
            return
        if not isinstance(data, dict) or not any(isinstance(data.get(key), list) for key in ("updates", "actions", "teams")):
            self.send_error(400, "Expected tracker data")
            return
        text = json.dumps(data, indent=2)
        TEMP_FILE.write_text(text + "\n", encoding="utf-8")
        TEMP_FILE.replace(DATA_FILE)
        payload = b'{"ok": true}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def export_report_pdf(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0 or length > 8_000_000:
            self.send_error(400, "Report was empty or too large")
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            html = payload.get("html")
            filename = payload.get("filename") or "weekly-report.pdf"
            width = payload.get("width")
            height = payload.get("height")
        except (UnicodeDecodeError, json.JSONDecodeError, AttributeError):
            self.send_error(400, "Expected a report document")
            return
        if not isinstance(html, str) or "<" not in html:
            self.send_error(400, "Expected the report document")
            return
        safe_name = "".join(char if char.isalnum() or char in "._-" else "-" for char in str(filename)).strip("-") or "weekly-report.pdf"
        if not safe_name.lower().endswith(".pdf"):
            safe_name += ".pdf"
        try:
            pdf = render_report_pdf(html, width, height)
        except (OSError, subprocess.TimeoutExpired, RuntimeError) as error:
            message = str(error).encode("utf-8")
            self.send_response(500)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(message)))
            self.end_headers()
            self.wfile.write(message)
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Length", str(len(pdf)))
        self.send_header("Content-Disposition", f'attachment; filename="{safe_name}"')
        self.end_headers()
        self.wfile.write(pdf)


def find_browser():
    candidates = [
        os.environ.get("CHROME_PATH"),
        shutil.which("google-chrome"),
        shutil.which("google-chrome-stable"),
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
        shutil.which("microsoft-edge"),
        shutil.which("msedge"),
        "/usr/local/bin/google-chrome",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return candidate
    return None


def pdf_window_size(width, height):
    try:
        page_width = int(width)
        page_height = int(height)
    except (TypeError, ValueError):
        page_width, page_height = 1440, 2400
    # Keep the print viewport wider than the 1200px layout breakpoint so the
    # report stays in the same columns as the on-screen dashboard.
    page_width = min(max(page_width, 1280), 4000)
    page_height = min(max(page_height, 900), 40000)
    return page_width, page_height


def render_report_pdf(html, width=None, height=None):
    browser = find_browser()
    if not browser:
        raise RuntimeError("Chrome or Edge is required to download the PDF. Install one, then export again.")
    page_width, page_height = pdf_window_size(width, height)
    with tempfile.TemporaryDirectory() as folder:
        html_path = Path(folder) / "report.html"
        pdf_path = Path(folder) / "report.pdf"
        profile = Path(folder) / "profile"
        html_path.write_text(html, encoding="utf-8")
        log_path = Path(folder) / "chrome.log"
        command = [
            browser,
            f"--user-data-dir={profile}",
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--no-first-run",
            "--no-default-browser-check",
            "--no-pdf-header-footer",
            "--hide-scrollbars",
            f"--window-size={page_width},{page_height}",
            f"--print-to-pdf={pdf_path}",
            html_path.as_uri(),
        ]
        with log_path.open("w", encoding="utf-8") as log_file:
            process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=log_file)
            deadline = time.time() + 40
            stable_since = None
            last_size = -1
            while time.time() < deadline:
                if pdf_path.exists():
                    size = pdf_path.stat().st_size
                    if size > 1000 and size == last_size:
                        stable_since = stable_since or time.time()
                        if time.time() - stable_since >= 1.2:
                            break
                    else:
                        stable_since = None
                    last_size = size
                if process.poll() is not None:
                    break
                time.sleep(0.25)
            if process.poll() is None:
                process.kill()
                process.wait(timeout=5)
        if not pdf_path.exists() or pdf_path.stat().st_size < 800:
            detail = log_path.read_text(encoding="utf-8", errors="replace").strip().splitlines()
            raise RuntimeError(detail[-1] if detail else "PDF was not created")
        return pdf_path.read_bytes()


def main():
    parser = argparse.ArgumentParser(description="Run the Daily Tracker and save tracker-data.json")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), TrackerHandler)
    except OSError as error:
        raise SystemExit(f"Port {args.port} is already in use. Run: python3 server.py --port 3000\n{error}")
    print(f"Daily Tracker: http://127.0.0.1:{args.port}")
    print(f"Notes file:    {DATA_FILE}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
