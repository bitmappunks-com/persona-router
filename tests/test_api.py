from __future__ import annotations

import shutil
from pathlib import Path

from fastapi.testclient import TestClient

from persona_router.api import create_app


ROOT = Path(__file__).resolve().parents[1]


def make_api_root(tmp_path: Path) -> Path:
    root = tmp_path / "repo"
    root.mkdir()
    shutil.copytree(ROOT / "schemas", root / "schemas")
    shutil.copytree(ROOT / "examples", root / "examples")
    shutil.copytree(ROOT / "warren-buffett-perspective", root / "warren-buffett-perspective")
    shutil.copytree(ROOT / "community-personas", root / "community-personas")
    return root


def test_api_session_round_next_flow(tmp_path: Path) -> None:
    root = make_api_root(tmp_path)
    client = TestClient(create_app(root))

    page = client.get("/")
    assert page.status_code == 200
    assert "Persona Router" in page.text
    asset = client.get("/static/app.js")
    assert asset.status_code == 200
    assert "runRound" in asset.text

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
