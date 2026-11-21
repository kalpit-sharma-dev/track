#!/usr/bin/env python3
"""Serve the tracker and store notes in tracker-data.json beside this file."""

import argparse
import json
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
        if self.path.split("?", 1)[0] != "/api/data":
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
