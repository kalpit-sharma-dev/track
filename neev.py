"""Neev (HDFC Gen AI Gateway) client.

Chat and embeddings follow the OpenAI-compatible contract in the NEEV
integration reference. Secrets come from the environment and are never
logged. A missing key or a failed call is a NeevError so the tracker can
keep its existing behavior.
"""

import json
import os
import random
import re
import ssl
import threading
import time
import urllib.error
import urllib.request

CATEGORIES = {"meeting", "discussion", "review", "approval", "audit", "planning", "issue", "other"}
STATUSES = {"pending", "in-progress", "completed", "blocked"}
STATUS_ALIASES = {
    "pending": "pending",
    "to do": "pending",
    "todo": "pending",
    "open": "pending",
    "in progress": "in-progress",
    "in-progress": "in-progress",
    "wip": "in-progress",
    "doing": "in-progress",
    "completed": "completed",
    "complete": "completed",
    "done": "completed",
    "closed": "completed",
    "blocked": "blocked",
    "blocker": "blocked",
}
PRIORITIES = {"low", "medium", "high"}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
RETRYABLE_TEXT = ("rate_limit", "rate limit", "resource_exhausted", "provisioned throughput", "provisioned-throughput")


class NeevError(Exception):
    """The gateway could not answer. Callers fall back to the current tracker behavior."""


class IntervalLimiter:
    """Process-local gap between calls. Chat and embeddings use separate limiters."""

    def __init__(self):
        self._lock = threading.Lock()
        self._last = 0.0

    def wait(self, interval, deadline):
        with self._lock:
            remaining = interval - (time.monotonic() - self._last)
            if remaining > 0:
                if time.monotonic() + remaining > deadline:
                    raise NeevError("Neev rate limit would exceed the request deadline")
                time.sleep(remaining)
            self._last = time.monotonic()


def _duration(value, default):
    text = str(value or "").strip().lower()
    if not text:
        return default
    try:
        if text.endswith("ms"):
            return max(0.0, float(text[:-2]) / 1000)
        if text.endswith("s"):
            return max(0.0, float(text[:-1]))
        return max(0.0, float(text))
    except ValueError as error:
        raise NeevError("Neev timeout or interval is not a number") from error


def load_config(env=None):
    source = os.environ if env is None else env
    insecure = str(source.get("NEEV_INSECURE_SKIP_VERIFY", "")).strip().lower() in {"1", "true", "yes"}
    return {
        "chat_url": str(source.get("NEEV_CHAT_URL", "")).strip(),
        "chat_key": str(source.get("NEEV_CHAT_API_KEY", "")).strip(),
        "chat_model": str(source.get("NEEV_CHAT_MODEL", "")).strip() or "gemini-2.5-flash",
        "embed_url": str(source.get("NEEV_EMBED_URL", "")).strip(),
        "embed_key": str(source.get("NEEV_EMBED_API_KEY", "")).strip(),
        "embed_model": str(source.get("NEEV_EMBED_MODEL", "")).strip() or "BAAI/bge-m3",
        "usecase": str(source.get("NEEV_USECASE_ID", "")).strip(),
        "insecure": insecure,
        "timeout": _duration(source.get("NEEV_TIMEOUT"), 60),
        "min_interval": _duration(source.get("NEEV_MIN_INTERVAL"), 7),
    }


def chat_configured(config):
    return bool(config.get("chat_url") and config.get("chat_key"))


def embed_configured(config):
    return bool(config.get("embed_url") and config.get("embed_key"))


class NeevClient:
    def __init__(self, config=None, opener=None):
        self.config = config or load_config()
        self._opener = opener
        self._chat_limit = IntervalLimiter()
        self._embed_limit = IntervalLimiter()
        self._ssl = ssl._create_unverified_context() if self.config["insecure"] else ssl.create_default_context()

    def chat(self, messages, temperature=0, max_tokens=1200):
        if not chat_configured(self.config):
            raise NeevError("Neev chat is not configured")
        if not messages:
            raise NeevError("Neev chat needs a message")
        body = {
            "model": self.config["chat_model"],
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        payload = self._post(
            self.config["chat_url"],
            body,
            self._chat_headers(),
            self._chat_limit,
        )
        choices = payload.get("choices")
        if not isinstance(choices, list) or not choices:
            raise NeevError("Neev chat returned no choices")
        message = choices[0].get("message") if isinstance(choices[0], dict) else None
        content = message.get("content") if isinstance(message, dict) else None
        if not isinstance(content, str) or not content.strip():
            raise NeevError("Neev chat returned an empty answer")
        return content.strip()

    def embed(self, texts):
        if not embed_configured(self.config):
            raise NeevError("Neev embeddings are not configured")
        clean = [str(text).strip() for text in texts if str(text).strip()]
        if not clean:
            raise NeevError("Neev embeddings need text")
        if len(clean) > 16:
            raise NeevError("Neev embeddings accept at most 16 texts at once")
        payload = self._post(
            self.config["embed_url"],
            {"input": clean, "model": self.config["embed_model"]},
            self._embed_headers(),
            self._embed_limit,
        )
        rows = payload.get("data")
        if not isinstance(rows, list) or not rows:
            raise NeevError("Neev embeddings returned no vectors")
        vectors = [None] * len(clean)
        width = None
        for row in rows:
            if not isinstance(row, dict):
                raise NeevError("Neev embeddings returned a malformed vector")
            index = row.get("index")
            vector = row.get("embedding")
            if not isinstance(index, int) or index < 0 or index >= len(clean):
                raise NeevError("Neev embeddings returned an index outside the input")
            if not isinstance(vector, list) or not vector or not all(isinstance(value, (int, float)) for value in vector):
                raise NeevError("Neev embeddings returned an invalid vector")
            if width is None:
                width = len(vector)
            elif len(vector) != width:
                raise NeevError("Neev embeddings returned mixed vector sizes")
            vectors[index] = [float(value) for value in vector]
        if any(vector is None for vector in vectors):
            raise NeevError("Neev embeddings omitted an input")
        return vectors

    def _chat_headers(self):
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": self.config["chat_key"],
            "Authorization": f"Bearer {self.config['chat_key']}",
        }
        if self.config["usecase"]:
            headers["x-usecase-id"] = self.config["usecase"]
        return headers

    def _embed_headers(self):
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.config['embed_key']}",
        }
        if self.config["usecase"]:
            headers["x-usecase-id"] = self.config["usecase"]
        return headers

    def _post(self, url, body, headers, limiter):
        deadline = time.monotonic() + self.config["timeout"]
        delay = 0.2
        last_error = "Neev request failed"
        for attempt in range(4):
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            limiter.wait(self.config["min_interval"], deadline)
            request = urllib.request.Request(
                url,
                data=json.dumps(body).encode("utf-8"),
                headers=headers,
                method="POST",
            )
            retry_after = None
            try:
                response = self._open(request, max(0.1, min(remaining, self.config["timeout"])))
                raw = response.read()
                status = getattr(response, "status", 200)
                retry_after = _header(response, "Retry-After")
            except urllib.error.HTTPError as error:
                raw = error.read()
                status = error.code
                retry_after = error.headers.get("Retry-After") if error.headers else None
            except (urllib.error.URLError, TimeoutError, OSError):
                last_error = "Neev could not be reached"
                if attempt == 3:
                    break
                self._sleep(delay, deadline)
                delay = min(delay * 2, 4)
                continue
            text = raw.decode("utf-8", "replace")
            if 200 <= status < 300:
                try:
                    payload = json.loads(text)
                except json.JSONDecodeError as error:
                    raise NeevError("Neev returned malformed JSON") from error
                if not isinstance(payload, dict):
                    raise NeevError("Neev returned an unexpected response")
                if payload.get("error"):
                    message = payload["error"].get("message") if isinstance(payload["error"], dict) else ""
                    if self._retryable(status, str(message)) and attempt < 3:
                        last_error = "Neev rate limit"
                        self._sleep(self._retry_wait(retry_after, delay), deadline)
                        delay = min(delay * 2, 4)
                        continue
                    raise NeevError("Neev rejected the request")
                return payload
            last_error = "Neev rate limit" if self._retryable(status, text) else "Neev rejected the request"
            if not self._retryable(status, text) or attempt == 3:
                break
            self._sleep(self._retry_wait(retry_after, delay), deadline)
            delay = min(delay * 2, 4)
        raise NeevError(last_error)

    def _open(self, request, timeout):
        if self._opener:
            return self._opener(request, timeout)
        return urllib.request.urlopen(request, timeout=timeout, context=self._ssl)

    def _retryable(self, status, text):
        if status == 429 or status >= 500:
            return True
        lowered = text.lower()
        return any(token in lowered for token in RETRYABLE_TEXT)

    def _retry_wait(self, retry_after, delay):
        text = str(retry_after or "").strip()
        if text.isdigit():
            return min(float(text), 8)
        return delay + random.uniform(0, delay * 0.25)

    def _sleep(self, delay, deadline):
        if delay <= 0 or time.monotonic() + delay > deadline:
            return
        time.sleep(delay)


def _header(response, name):
    headers = getattr(response, "headers", None)
    if headers is None:
        return None
    getter = getattr(headers, "get", None)
    return getter(name) if getter else None


def extract_json(text):
    raw = str(text or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            return json.loads(raw[start:end + 1])
        raise


def _clean_text(value, limit=500):
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def _date(value):
    text = str(value or "").strip()
    if not DATE_RE.match(text):
        return ""
    year, month, day = (int(part) for part in text.split("-"))
    if month < 1 or month > 12 or day < 1 or day > 31:
        return ""
    return text


def _status(value, default=""):
    key = str(value or "").strip().lower()
    if not key:
        return default
    return STATUS_ALIASES.get(key, default)


def _team(value, teams):
    text = _clean_text(value, 80)
    if not text:
        return ""
    for name in teams:
        if name.strip().lower() == text.lower():
            return name
    return ""


def sanitize_filed_note(payload, teams):
    if not isinstance(payload, dict):
        raise NeevError("Neev filed note was not an object")
    category = str(payload.get("category") or "").strip().lower()
    return {
        "team": _team(payload.get("team"), teams),
        "people": _clean_text(payload.get("people"), 200),
        "jira": _clean_text(payload.get("jira"), 40),
        "status": _status(payload.get("status")),
        "targetDate": _date(payload.get("targetDate")),
        "category": category if category in CATEGORIES else "",
    }


def sanitize_import(payload):
    if not isinstance(payload, dict):
        return None
    teams = []
    updates = []
    actions = []
    for row in payload.get("teams") or []:
        if not isinstance(row, dict):
            continue
        name = _clean_text(row.get("name"), 80)
        if not name:
            continue
        teams.append({
            "line": 0,
            "name": name,
            "description": _clean_text(row.get("description"), 300),
            "members": _clean_text(row.get("members"), 300),
            "color": "#6366F1",
            "targetDate": _date(row.get("targetDate")),
            "jira": _clean_text(row.get("jira"), 40),
            "status": _status(row.get("status")),
        })
    for row in payload.get("updates") or []:
        if not isinstance(row, dict):
            continue
        description = _clean_text(row.get("description"), 1000)
        date = _date(row.get("date"))
        if not description or not date:
            continue
        category = str(row.get("category") or "").strip().lower()
        tags = row.get("tags") if isinstance(row.get("tags"), list) else []
        updates.append({
            "line": 0,
            "date": date,
            "targetDate": _date(row.get("targetDate")),
            "jira": _clean_text(row.get("jira"), 40),
            "status": _status(row.get("status")),
            "category": category if category in CATEGORIES else "discussion",
            "categoryWarning": "",
            "teamName": _clean_text(row.get("teamName") or row.get("team"), 80),
            "people": _clean_text(row.get("people"), 200),
            "tags": [_clean_text(tag, 40).lower() for tag in tags if _clean_text(tag, 40)],
            "description": description,
        })
    for row in payload.get("actions") or []:
        if not isinstance(row, dict):
            continue
        title = _clean_text(row.get("title"), 200)
        if not title:
            continue
        priority = str(row.get("priority") or "medium").strip().lower()
        actions.append({
            "line": 0,
            "title": title,
            "description": _clean_text(row.get("description") or row.get("notes"), 500),
            "owner": _clean_text(row.get("owner"), 80) or "Me",
            "priority": priority if priority in PRIORITIES else "medium",
            "status": _status(row.get("status"), "pending"),
            "dueDate": _date(row.get("dueDate") or row.get("targetDate")),
            "teamName": _clean_text(row.get("teamName") or row.get("team"), 80),
            "jira": _clean_text(row.get("jira"), 40),
            "recurring": "",
            "notes": _clean_text(row.get("notes"), 500),
        })
    if not teams and not updates and not actions:
        return None
    return {"teams": teams, "updates": updates, "actions": actions, "errors": []}


FILE_NOTE_SYSTEM = (
    "You file one daily note into an existing tracker. "
    "Read only the description. Return one JSON object and nothing else. "
    "Keys: team, people, jira, status, targetDate, category. "
    "team must be copied from the supplied team list, or be an empty string. "
    "people is a comma-separated list of names that appear in the description. "
    "jira is the ticket or Jira id written in the description, or empty. "
    "status is pending, in-progress, completed, blocked, or empty. "
    "targetDate is YYYY-MM-DD only when a target or due date is written, otherwise empty. "
    "category is one of meeting, discussion, review, approval, audit, planning, issue, other, or empty. "
    "Do not invent a person, ticket, date, team, or status."
)

PARSE_SYSTEM = (
    "You turn uploaded notes into tracker records. "
    "Return one JSON object with keys teams, updates, and actions. "
    "Each update needs date (YYYY-MM-DD), description, and may include teamName, people, jira, status, targetDate, category, tags. "
    "status is pending, in-progress, completed, or blocked. "
    "category is meeting, discussion, review, approval, audit, planning, issue, or other. "
    "Each action needs title and may include owner, teamName, jira, status, dueDate, priority, notes. "
    "Each team needs name and may include members, description, jira, status, targetDate. "
    "Copy only facts written in the file. Do not invent tickets, people, or dates. "
    "If a note has no date, leave it out."
)

ASK_SYSTEM = (
    "You answer a question about one management report. "
    "Use only the report text. If the report does not contain the answer, say it is not in this report. "
    "Do not invent work, people, dates, or ticket numbers. Keep the answer short enough to paste into an email."
)
