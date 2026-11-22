"""Neev client tests against a local stand-in for the gateway."""

import json
import os
import threading
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import neev
import server


def config(chat_url, embed_url):
    return {
        "chat_url": chat_url,
        "chat_key": "chat-secret",
        "chat_model": "gemini-2.5-flash",
        "embed_url": embed_url,
        "embed_key": "embed-secret",
        "embed_model": "BAAI/bge-m3",
        "usecase": "drishti-ai",
        "insecure": False,
        "timeout": 5,
        "min_interval": 0,
    }


class ScriptedGateway(BaseHTTPRequestHandler):
    script = []
    seen = []

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        ScriptedGateway.seen.append({
            "path": self.path,
            "headers": {key: value for key, value in self.headers.items()},
            "body": json.loads(body.decode("utf-8")),
        })
        status, payload, extra = ScriptedGateway.script.pop(0)
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        if extra:
            self.send_header("Retry-After", extra)
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, fmt, *args):
        return


class NeevConfigTest(unittest.TestCase):
    def test_env_file_supplies_the_key_and_an_ip_host_skips_certificate_checks(self):
        path = Path("/tmp/neev-test.env")
        path.write_text('export NEEV_CHAT_API_KEY="from-file"\nNEEV_CHAT_URL=https://10.216.70.62/DEV/litellm/chat/completions\n', encoding="utf-8")
        saved = {key: os.environ.pop(key) for key in list(os.environ) if key.startswith("NEEV_")}
        try:
            config = neev.load_config(env_file=path)
            self.assertEqual(config["chat_key"], "from-file")
            self.assertEqual(config["chat_url"], "https://10.216.70.62/DEV/litellm/chat/completions")
            self.assertEqual(config["usecase"], "drishti-ai")
            self.assertTrue(config["insecure"])
            explicit = neev.load_config(env={
                "NEEV_CHAT_URL": "https://10.216.70.62/DEV/litellm/chat/completions",
                "NEEV_CHAT_API_KEY": "k",
                "NEEV_INSECURE_SKIP_VERIFY": "false",
            })
            self.assertFalse(explicit["insecure"])
            mac = Path("/tmp/neev-mac.env")
            mac.write_bytes(b"# saved on mac \x9c\nNEEV_CHAT_API_KEY=real-key\n")
            wide = Path("/tmp/neev-wide.env")
            wide.write_bytes("NEEV_CHAT_API_KEY=wide-key\n".encode("utf-16"))
            try:
                mac_config = neev.load_config(env_file=mac)
                wide_config = neev.load_config(env_file=wide)
            finally:
                mac.unlink(missing_ok=True)
                wide.unlink(missing_ok=True)
            self.assertEqual(mac_config["chat_key"], "real-key")
            self.assertEqual(wide_config["chat_key"], "wide-key")
        finally:
            path.unlink(missing_ok=True)
            os.environ.update(saved)


class NeevClientTest(unittest.TestCase):
    def setUp(self):
        ScriptedGateway.script = []
        ScriptedGateway.seen = []
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), ScriptedGateway)
        self.port = self.httpd.server_address[1]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        base = f"http://127.0.0.1:{self.port}"
        self.client = neev.NeevClient(config(base + "/chat", base + "/embed"))

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()

    def test_chat_sends_both_auth_headers_and_returns_the_answer(self):
        ScriptedGateway.script.append((200, {"choices": [{"message": {"role": "assistant", "content": "From the report"}}]}, None))
        answer = self.client.chat([{"role": "user", "content": "What shipped?"}])
        self.assertEqual(answer, "From the report")
        sent = ScriptedGateway.seen[0]
        self.assertEqual(sent["path"], "/chat")
        self.assertEqual(sent["headers"]["X-Goog-Api-Key"], "chat-secret")
        self.assertEqual(sent["headers"]["Authorization"], "Bearer chat-secret")
        self.assertEqual(sent["headers"]["X-Usecase-Id"], "drishti-ai")
        self.assertEqual(sent["body"]["model"], "gemini-2.5-flash")
        self.assertEqual(sent["body"]["messages"][0]["content"], "What shipped?")

    def test_embed_maps_vectors_by_index(self):
        ScriptedGateway.script.append((200, {
            "data": [
                {"index": 1, "embedding": [0.0, 1.0]},
                {"index": 0, "embedding": [1.0, 0.0]},
            ]
        }, None))
        vectors = self.client.embed(["first", "second"])
        self.assertEqual(vectors, [[1.0, 0.0], [0.0, 1.0]])
        sent = ScriptedGateway.seen[0]
        self.assertEqual(sent["path"], "/embed")
        self.assertEqual(sent["headers"]["Authorization"], "Bearer embed-secret")
        self.assertNotIn("X-Goog-Api-Key", sent["headers"])
        self.assertEqual(sent["body"], {"input": ["first", "second"], "model": "BAAI/bge-m3"})

    def test_retries_429_then_returns_the_answer(self):
        ScriptedGateway.script.append((429, {"error": {"message": "rate_limit"}}, "0"))
        ScriptedGateway.script.append((200, {"choices": [{"message": {"content": "ok"}}]}, None))
        self.assertEqual(self.client.chat([{"role": "user", "content": "Hi"}]), "ok")
        self.assertEqual(len(ScriptedGateway.seen), 2)

    def test_reads_answer_text_from_content_parts(self):
        ScriptedGateway.script.append((200, {"choices": [{"message": {"content": [
            {"type": "text", "text": "{\"team\": \"Deposits\"}"}
        ]}}]}, None))
        self.assertIn("Deposits", self.client.chat([{"role": "user", "content": "File it"}]))

    def test_does_not_retry_a_permanent_client_error(self):
        ScriptedGateway.script.append((400, {"error": {"message": "bad request"}}, None))
        with self.assertRaises(neev.NeevError):
            self.client.chat([{"role": "user", "content": "Hi"}])
        self.assertEqual(len(ScriptedGateway.seen), 1)

    def test_rejects_empty_choices_and_bad_embedding_indexes(self):
        ScriptedGateway.script.append((200, {"choices": []}, None))
        with self.assertRaises(neev.NeevError):
            self.client.chat([{"role": "user", "content": "Hi"}])
        ScriptedGateway.script.append((200, {"data": [{"index": 4, "embedding": [1.0]}]}, None))
        with self.assertRaises(neev.NeevError):
            self.client.embed(["only"])

    def test_missing_key_does_not_call_the_gateway(self):
        bare = neev.NeevClient(config("", ""))
        bare.config["chat_key"] = ""
        bare.config["embed_key"] = ""
        with self.assertRaises(neev.NeevError):
            bare.chat([{"role": "user", "content": "Hi"}])
        with self.assertRaises(neev.NeevError):
            bare.embed(["Hi"])
        self.assertEqual(ScriptedGateway.seen, [])

    def test_sanitize_keeps_only_fields_that_were_actually_returned(self):
        fields = neev.sanitize_filed_note({
            "team": "No Such Team",
            "people": "Murthy, Rajesh",
            "jira": "RITM8019999",
            "status": "blocked",
            "targetDate": "not-a-date",
            "category": "issue",
        }, ["Performance Pod"])
        self.assertEqual(fields["team"], "")
        self.assertEqual(fields["people"], "Murthy, Rajesh")
        self.assertEqual(fields["jira"], "RITM8019999")
        self.assertEqual(fields["status"], "blocked")
        self.assertEqual(fields["targetDate"], "")
        self.assertEqual(fields["category"], "issue")
        parsed = neev.sanitize_import({
            "updates": [
                {"date": "2026-11-21", "description": "Morning sync", "teamName": "Performance Pod"},
                {"description": "No date here"},
            ],
            "actions": [{"title": "Share the trace", "owner": "Rajesh"}],
            "teams": [{"name": ""}],
        })
        self.assertEqual(len(parsed["updates"]), 1)
        self.assertEqual(parsed["updates"][0]["date"], "2026-11-21")
        self.assertEqual(parsed["actions"][0]["owner"], "Rajesh")
        self.assertEqual(neev.extract_json("```json\n{\"team\": \"Performance Pod\"}\n```")["team"], "Performance Pod")
        note = "Performance Pod is blocked with Murthy on RITM8019999. Target 30 Nov 2026."
        grounded = neev.ground_filed_note(neev.sanitize_filed_note({
            "team": "Performance Pod",
            "people": "Murthy, Invented Person",
            "jira": "RITM8019999",
            "status": "blocked",
            "targetDate": "2026-11-30",
            "category": "issue",
        }, ["Performance Pod"]), note)
        self.assertEqual(grounded["team"], "Performance Pod")
        self.assertEqual(grounded["people"], "Murthy")
        self.assertEqual(grounded["jira"], "RITM8019999")
        self.assertEqual(grounded["targetDate"], "2026-11-30")
        invented = neev.ground_filed_note({
            "team": "Performance Pod",
            "people": "Murthy, Invented Person",
            "jira": "RITM8019999",
            "status": "blocked",
            "targetDate": "2026-11-30",
            "category": "issue",
        }, "Morning sync with Murthy.")
        self.assertEqual(invented["people"], "Murthy")
        self.assertEqual(invented["jira"], "")
        self.assertEqual(invented["team"], "")
        self.assertEqual(invented["status"], "")
        self.assertEqual(invented["targetDate"], "")
        parsed = neev.ground_import(neev.sanitize_import({
            "updates": [
                {"date": "2026-11-21", "description": "Kavita finished the deposits review", "teamName": "Deposits", "people": "Kavita", "jira": "DEP-55", "status": "completed", "category": "review"},
                {"date": "2026-11-21", "description": "Invented a migration program", "people": "Nobody"},
            ]
        }), "On 21 Nov 2026 Kavita finished the deposits review for DEP-55.")
        self.assertEqual(len(parsed["updates"]), 1)
        self.assertEqual(parsed["updates"][0]["jira"], "DEP-55")


class TrackerRouteTest(unittest.TestCase):
    def setUp(self):
        self.saved = {key: os.environ.get(key) for key in (
            "NEEV_CHAT_URL", "NEEV_CHAT_API_KEY", "NEEV_EMBED_URL", "NEEV_EMBED_API_KEY", "NEEV_USECASE_ID", "NEEV_MIN_INTERVAL"
        )}
        for key in self.saved:
            os.environ.pop(key, None)
        server._CLIENT = None
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.TrackerHandler)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        for key, value in self.saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        server._CLIENT = None
        for path in (server.EMBED_FILE, server.EMBED_FILE.with_suffix(".json.tmp")):
            if path.exists():
                path.unlink()

    def post(self, path, payload):
        request = urllib.request.Request(
            f"http://127.0.0.1:{self.port}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=5) as response:
                return response.status, json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read().decode("utf-8"))

    def test_unconfigured_assistant_asks_the_client_to_fall_back(self):
        status, body = self.post("/api/ai/ask", {"question": "What shipped?", "report": "Nothing new."})
        self.assertEqual(status, 503)
        self.assertTrue(body["fallback"])
        status, body = self.post("/api/ai/parse-notes", {"text": "17 Nov 2026\n- Morning sync"})
        self.assertEqual(status, 503)
        self.assertTrue(body["fallback"])
        with urllib.request.urlopen(f"http://127.0.0.1:{self.port}/api/ai/status", timeout=5) as response:
            status_body = json.loads(response.read().decode("utf-8"))
        self.assertEqual(status_body["chat"], False)
        self.assertEqual(status_body["embed"], False)
        self.assertIn("NEEV_CHAT_API_KEY", status_body["reason"])
        self.assertIn("neev.env", body["reason"])

    def test_file_note_and_embeddings_round_trip(self):
        gateway = ThreadingHTTPServer(("127.0.0.1", 0), ScriptedGateway)
        threading.Thread(target=gateway.serve_forever, daemon=True).start()
        port = gateway.server_address[1]
        os.environ["NEEV_CHAT_URL"] = f"http://127.0.0.1:{port}/chat"
        os.environ["NEEV_CHAT_API_KEY"] = "chat-secret"
        os.environ["NEEV_EMBED_URL"] = f"http://127.0.0.1:{port}/embed"
        os.environ["NEEV_EMBED_API_KEY"] = "embed-secret"
        os.environ["NEEV_USECASE_ID"] = "drishti-ai"
        os.environ["NEEV_MIN_INTERVAL"] = "0"
        server._CLIENT = None
        ScriptedGateway.script = [(200, {"choices": [{"message": {"content": json.dumps({
            "team": "Performance Pod",
            "people": "Murthy",
            "jira": "RITM8019999",
            "status": "blocked",
            "targetDate": "2026-11-30",
            "category": "issue",
        })}}]}, None)]
        status, body = self.post("/api/ai/file-note", {
            "description": "Performance Pod is blocked with Murthy, RITM8019999, target 30 Nov 2026",
            "teams": ["Performance Pod", "Deposits"],
        })
        self.assertEqual(status, 200)
        self.assertEqual(body["fields"]["team"], "Performance Pod")
        self.assertEqual(body["fields"]["jira"], "RITM8019999")
        self.assertEqual(body["fields"]["targetDate"], "2026-11-30")
        ScriptedGateway.script.append((200, {"choices": [{"message": {"content": json.dumps({
            "team": "Performance Pod",
            "people": "Invented Person",
            "jira": "FAKE-1",
            "status": "blocked",
            "targetDate": "2026-12-01",
            "category": "audit",
        })}}]}, None))
        status, body = self.post("/api/ai/file-note", {
            "description": "Morning sync with Murthy.",
            "teams": ["Performance Pod"],
        })
        self.assertEqual(status, 200)
        self.assertEqual(body["fields"]["people"], "")
        self.assertEqual(body["fields"]["jira"], "")
        self.assertEqual(body["fields"]["team"], "")
        self.assertEqual(body["fields"]["targetDate"], "")
        ScriptedGateway.script.append((200, {"data": [{"index": 0, "embedding": [0.2, 0.8]}]}, None))
        status, body = self.post("/api/ai/embed", {"input": ["slow screens"]})
        self.assertEqual(body["embeddings"], [[0.2, 0.8]])
        status, body = self.post("/api/embeddings", {"vectors": {"note-1": {"hash": "abc", "vector": [0.2, 0.8]}}})
        self.assertEqual(status, 200)
        with urllib.request.urlopen(f"http://127.0.0.1:{self.port}/api/embeddings", timeout=5) as response:
            stored = json.loads(response.read().decode("utf-8"))
        self.assertEqual(stored["vectors"]["note-1"]["vector"], [0.2, 0.8])
        gateway.shutdown()
        gateway.server_close()


if __name__ == "__main__":
    unittest.main()
