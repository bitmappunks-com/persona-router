from __future__ import annotations

from pathlib import Path

from persona_router.registry import load_registry
from persona_router.session import RouterSession
from persona_router.store import SQLiteSessionStore


ROOT = Path(__file__).resolve().parents[1]


def test_sqlite_session_store_round_trips_session(tmp_path: Path) -> None:
    registry = load_registry(
        [Path("examples/persona-registry.json"), Path("examples/community-persona-registry.json")],
        root=ROOT,
    )
    store = SQLiteSessionStore(tmp_path / "sessions.db")
    session = RouterSession.new(registry, session_id="sess_sqlite")
    session.topic = "讨论产品发布"
    session.active_agent_ids = ["community_feynman"]

    store.save(session)
    loaded = store.load("sess_sqlite")

    assert loaded.session_id == "sess_sqlite"
    assert loaded.topic == "讨论产品发布"
    assert loaded.active_agent_ids == ["community_feynman"]
