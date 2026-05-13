from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol

from .session import RouterSession, load_session, save_session, session_path


def _snippet(turn: dict | None) -> str | None:
    if not turn:
        return None
    content = turn.get("content") or ""
    if not isinstance(content, str):
        return None
    flat = content.replace("\n", " ").strip()
    if len(flat) > 60:
        return flat[:60] + "…"
    return flat or None


class SessionStore(Protocol):
    def load(self, session_id: str) -> RouterSession:
        """Load one session by id."""

    def save(self, session: RouterSession) -> None:
        """Persist one session."""

    def list(self) -> list[dict]:
        """Return summary rows {session_id, topic, member_count, round_index, updated_at} newest first."""


class JsonFileSessionStore:
    def __init__(self, root: Path | str) -> None:
        self.root = Path(root)

    def load(self, session_id: str) -> RouterSession:
        return load_session(session_path(self.root, session_id))

    def save(self, session: RouterSession) -> None:
        save_session(session, session_path(self.root, session.session_id))

    def list(self) -> list[dict]:
        dir_path = self.root / ".persona-router" / "sessions"
        if not dir_path.exists():
            return []
        rows: list[dict] = []
        for path in dir_path.glob("*.json"):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            updated_at = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()
            turns = payload.get("turns") or []
            last_turn = turns[-1] if turns else None
            last_active_at = (last_turn or {}).get("created_at") if isinstance(last_turn, dict) else None
            rows.append(
                {
                    "session_id": payload.get("session_id") or path.stem,
                    "topic": payload.get("topic"),
                    "kind": payload.get("kind", "group"),
                    "name": payload.get("name"),
                    "direct_handle": payload.get("direct_handle"),
                    "archived": bool(payload.get("archived", False)),
                    "member_count": len(payload.get("active_agent_ids", [])),
                    "round_index": int(payload.get("round_index", 0)),
                    "turn_count": len(turns),
                    "last_active_at": last_active_at or updated_at,
                    "last_snippet": _snippet(last_turn) if isinstance(last_turn, dict) else None,
                    "updated_at": updated_at,
                }
            )
        rows.sort(key=lambda r: r["last_active_at"], reverse=True)
        return rows


class SQLiteSessionStore:
    def __init__(self, path: Path | str) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def load(self, session_id: str) -> RouterSession:
        with sqlite3.connect(self.path) as conn:
            row = conn.execute("SELECT payload FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
        if row is None:
            from .session import SessionError

            raise SessionError(f"Missing session: {session_id}")
        return RouterSession.from_dict(json.loads(row[0]))

    def save(self, session: RouterSession) -> None:
        payload = json.dumps(session.to_dict(), ensure_ascii=False)
        updated_at = datetime.now(timezone.utc).isoformat()
        with sqlite3.connect(self.path) as conn:
            conn.execute(
                """
                INSERT INTO sessions(session_id, payload, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                  payload = excluded.payload,
                  updated_at = excluded.updated_at
                """,
                (session.session_id, payload, updated_at),
            )

    def list(self) -> list[dict]:
        with sqlite3.connect(self.path) as conn:
            cursor = conn.execute(
                "SELECT session_id, payload, updated_at FROM sessions ORDER BY updated_at DESC"
            )
            rows: list[dict] = []
            for session_id, payload, updated_at in cursor:
                try:
                    data = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                turns = data.get("turns") or []
                last_turn = turns[-1] if turns else None
                last_active_at = (last_turn or {}).get("created_at") if isinstance(last_turn, dict) else None
                rows.append(
                    {
                        "session_id": session_id,
                        "topic": data.get("topic"),
                        "kind": data.get("kind", "group"),
                        "name": data.get("name"),
                        "direct_handle": data.get("direct_handle"),
                        "archived": bool(data.get("archived", False)),
                        "member_count": len(data.get("active_agent_ids", [])),
                        "round_index": int(data.get("round_index", 0)),
                        "turn_count": len(turns),
                        "last_active_at": last_active_at or updated_at,
                        "last_snippet": _snippet(last_turn) if isinstance(last_turn, dict) else None,
                        "updated_at": updated_at,
                    }
                )
        return rows

    def _initialize(self) -> None:
        with sqlite3.connect(self.path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                  session_id TEXT PRIMARY KEY,
                  payload TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                )
                """
            )
