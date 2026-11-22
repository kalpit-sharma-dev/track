#!/usr/bin/env python3
"""Serve the tracker and store notes in tracker-data.json beside this file."""

import argparse
import json
import os
import shutil
import subprocess
import tempfile
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from neev import (
    ASK_SYSTEM,
    FILE_NOTE_SYSTEM,
    NeevError,
    PARSE_SYSTEM,
    chat_configured,
    embed_configured,
    extract_json,
    ground_filed_note,
    ground_import,
    load_config,
    NeevClient,
    sanitize_filed_note,
    sanitize_import,
)

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "tracker-data.json"
TEMP_FILE = ROOT / "tracker-data.json.tmp"
EMBED_FILE = ROOT / "tracker-embeddings.json"
_CLIENT_LOCK = threading.Lock()
_CLIENT = None
_CLIENT_STAMP = None


def neev_client():
    global _CLIENT, _CLIENT_STAMP
    config = load_config()
    stamp = tuple(sorted((key, repr(value)) for key, value in config.items()))
    with _CLIENT_LOCK:
        if _CLIENT is None or stamp != _CLIENT_STAMP:
            globals()["_CLIENT"] = NeevClient(config)
            globals()["_CLIENT_STAMP"] = stamp
        return _CLIENT


class TrackerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/ai/status":
            config = load_config()
            reason = ""
            if not config.get("chat_key"):
                reason = "Add NEEV_CHAT_API_KEY to neev.env in the app folder, then click Ask again."
            self.send_json(200, {
                "chat": chat_configured(config),
                "embed": embed_configured(config),
                "reason": reason,
            })
            return
        if path == "/api/embeddings":
            body = EMBED_FILE.read_bytes() if EMBED_FILE.exists() else b'{"vectors":{}}'
            self.send_bytes(200, body, "application/json; charset=utf-8")
            return
        if path != "/api/data":
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
        if path == "/api/ai/ask":
            self.ai_ask()
            return
        if path == "/api/ai/file-note":
            self.ai_file_note()
            return
        if path == "/api/ai/parse-notes":
            self.ai_parse_notes()
            return
        if path == "/api/ai/embed":
            self.ai_embed()
            return
        if path == "/api/embeddings":
            self.save_embeddings()
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

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_bytes(status, body, "application/json; charset=utf-8")

    def send_bytes(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self, limit):
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0 or length > limit:
            return None
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None

    def ai_fallback(self, reason="The assistant is unavailable. Use Copy for Email for the full report."):
        self.send_json(503, {"ok": False, "fallback": True, "reason": reason})

    def ai_ask(self):
        payload = self.read_json(80_000)
        question = str((payload or {}).get("question") or "").strip()
        report = str((payload or {}).get("report") or "").strip()
        if not question or not report:
            self.send_error(400, "Expected a question about one report")
            return
        try:
            answer = neev_client().chat([
                {"role": "system", "content": ASK_SYSTEM + "\n\nReport:\n" + report[:20000]},
                {"role": "user", "content": question[:1000]},
            ])
        except NeevError as error:
            self.ai_fallback(str(error))
            return
        self.send_json(200, {"ok": True, "answer": answer})

    def ai_file_note(self):
        payload = self.read_json(20_000)
        description = str((payload or {}).get("description") or "").strip()
        teams = [str(name).strip() for name in ((payload or {}).get("teams") or []) if str(name).strip()]
        if not description:
            self.send_error(400, "Expected a description")
            return
        try:
            raw = neev_client().chat([
                {"role": "system", "content": FILE_NOTE_SYSTEM},
                {"role": "user", "content": json.dumps({"description": description[:4000], "teams": teams[:40]})},
            ], max_tokens=1024)
            fields = ground_filed_note(sanitize_filed_note(extract_json(raw), teams[:40]), description)
        except NeevError as error:
            self.ai_fallback(str(error))
            return
        except (json.JSONDecodeError, ValueError):
            self.ai_fallback("The assistant could not read this description. The form was left as you typed it.")
            return
        self.send_json(200, {"ok": True, "fields": fields})

    def ai_parse_notes(self):
        payload = self.read_json(120_000)
        text = str((payload or {}).get("text") or "").strip()
        if not text:
            self.send_error(400, "Expected note text")
            return
        try:
            raw = neev_client().chat([
                {"role": "system", "content": PARSE_SYSTEM},
                {"role": "user", "content": text[:40000]},
            ], max_tokens=4096)
            parsed = ground_import(sanitize_import(extract_json(raw)), text)
        except NeevError as error:
            self.ai_fallback(str(error))
            return
        except (json.JSONDecodeError, ValueError):
            self.ai_fallback("The assistant could not read this file. The text template will be used.")
            return
        if not parsed:
            self.ai_fallback("The assistant could not find records in this file. The text template will be used.")
            return
        self.send_json(200, {"ok": True, "parsed": parsed})

    def ai_embed(self):
        payload = self.read_json(80_000)
        texts = (payload or {}).get("input")
        if not isinstance(texts, list) or not texts:
            self.send_error(400, "Expected texts to embed")
            return
        clean = [str(text).strip()[:2000] for text in texts[:16] if str(text).strip()]
        if not clean:
            self.send_error(400, "Expected texts to embed")
            return
        try:
            vectors = neev_client().embed(clean)
        except NeevError as error:
            self.ai_fallback(str(error))
            return
        self.send_json(200, {"ok": True, "embeddings": vectors})

    def save_embeddings(self):
        payload = self.read_json(2_000_000)
        incoming = (payload or {}).get("vectors") if isinstance(payload, dict) else None
        if not isinstance(incoming, dict):
            self.send_error(400, "Expected embedding vectors")
            return
        current = {"vectors": {}}
        if EMBED_FILE.exists():
            try:
                stored = json.loads(EMBED_FILE.read_text(encoding="utf-8"))
                if isinstance(stored.get("vectors"), dict):
                    current = stored
            except (OSError, json.JSONDecodeError):
                current = {"vectors": {}}
        for key, row in list(incoming.items())[:500]:
            if not isinstance(row, dict):
                continue
            vector = row.get("vector")
            digest = str(row.get("hash") or "")
            if not isinstance(vector, list) or not vector or len(vector) > 4096:
                continue
            if not all(isinstance(value, (int, float)) for value in vector):
                continue
            current["vectors"][str(key)[:80]] = {"hash": digest[:80], "vector": [float(value) for value in vector]}
        text = json.dumps(current)
        temporary = EMBED_FILE.with_suffix(".json.tmp")
        temporary.write_text(text + "\n", encoding="utf-8")
        temporary.replace(EMBED_FILE)
        self.send_json(200, {"ok": True, "count": len(current["vectors"])})

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
