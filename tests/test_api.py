from __future__ import annotations

import re
import shutil
from pathlib import Path

from fastapi.testclient import TestClient

from persona_router.api import create_app


ROOT = Path(__file__).resolve().parents[1]


def make_api_root(tmp_path: Path) -> Path:
    root = tmp_path / "repo"
    root.mkdir()
    shutil.copytree(ROOT / "registries", root / "registries")
    shutil.copytree(ROOT / "local-personas", root / "local-personas")
    shutil.copytree(ROOT / "community-personas", root / "community-personas")
    return root


def test_api_session_round_next_flow(tmp_path: Path) -> None:
    root = make_api_root(tmp_path)
    client = TestClient(create_app(root, llm_client=None))

    page = client.get("/")
    assert page.status_code == 200
    assert "Persona Router" in page.text
    match = re.search(r"/static/assets/[^\"' >]+\.js", page.text)
    assert match, "expected built JS bundle reference in index.html"
    asset = client.get(match.group(0))
    assert asset.status_code == 200

    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    agents = client.get("/agents")
    assert agents.status_code == 200
    assert any(agent["handle"] == "feynman" for agent in agents.json())

    created = client.post("/sessions")
    assert created.status_code == 200
    session_id = created.json()["session"]["session_id"]

    first = client.post(
        f"/sessions/{session_id}/round",
        json={"text": "@feynman @steve_jobs 讨论产品发布"},
    )
    assert first.status_code == 200
    assert first.json()["round"]["round_index"] == 1
    assert len(first.json()["round"]["turns"]) == 2

    second = client.post(f"/sessions/{session_id}/next")
    assert second.status_code == 200
    assert second.json()["round"]["round_index"] == 2
    assert [turn["trigger"] for turn in second.json()["round"]["turns"]] == ["active", "active"]
