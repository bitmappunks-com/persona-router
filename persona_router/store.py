from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol

from .session import RouterSession, load_session, save_session, session_path


class SessionStore(Protocol):
    def load(self, session_id: str) -> RouterSession:
        """Load one session by id."""

    def save(self, session: RouterSession) -> None:
        """Persist one session."""


class JsonFileSessionStore:
    def __init__(self, root: Path | str) -> None:
        self.root = Path(root)

    def load(self, session_id: str) -> RouterSession:
        return load_session(session_path(self.root, session_id))

    def save(self, session: RouterSession) -> None:
        save_session(session, session_path(self.root, session.session_id))


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
