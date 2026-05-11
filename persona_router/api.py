from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .commands import parse_input
from .executor import LLMClient, LLMConfig, run_llm_round, run_mock_round
from .llm import LLMConfigurationError, build_default_client, diagnose_llm_environment
from .planner import build_turn_plan
from .registry import RegistryError, default_registry_paths, load_registry
from .session import RouterSession, SessionError
from .store import JsonFileSessionStore, SessionStore


class ActiveRequest(BaseModel):
    handles: list[str]


class RoundRequest(BaseModel):
    text: str


def _executor_for(client: LLMClient | None, config: LLMConfig):
    if client is None:
        return None

    def runner(session, registry, plan):
        return run_llm_round(session, registry, plan, client, config)

    return runner


def create_app(
    root: Path | str = ".",
    store: SessionStore | None = None,
    llm_client: LLMClient | None | object = ...,
    llm_config: LLMConfig | None = None,
) -> FastAPI:
    repo_root = Path(root).resolve()
    # Load .env from the repo root before reading any LLM env vars
    load_dotenv(repo_root / ".env", override=False)
    session_store = store or JsonFileSessionStore(repo_root)

    # `...` sentinel = auto-detect from environment. None = force mock. Else use provided client.
    if llm_client is ...:
        resolved_client: LLMClient | None = build_default_client()
    else:
        resolved_client = llm_client  # type: ignore[assignment]

    resolved_config = llm_config or LLMConfig(
        model=os.environ.get("PERSONA_ROUTER_MODEL", "default"),
        temperature=float(os.environ.get("PERSONA_ROUTER_TEMPERATURE", "0.4")),
    )

    app = FastAPI(title="Persona Router", version="0.1.0")
    web_dir = Path(__file__).resolve().parent / "web"
    if web_dir.exists():
        app.mount("/static", StaticFiles(directory=web_dir), name="static")

    def registry():
        return load_registry(default_registry_paths(repo_root), root=repo_root)

    def execute(session, reg, plan):
        runner = _executor_for(resolved_client, resolved_config)
        if runner is None:
            return run_mock_round(session, reg, plan)
        return runner(session, reg, plan)

    @app.get("/", include_in_schema=False)
    def index() -> FileResponse:
        index_path = web_dir / "index.html"
        if not index_path.exists():
            raise HTTPException(status_code=404, detail="Web UI is not packaged")
        return FileResponse(index_path)

    @app.get("/health")
    def health() -> dict[str, Any]:
        env = diagnose_llm_environment()
        return {
            "status": "ok",
            "llm": {
                "enabled": resolved_client is not None,
                "model": resolved_config.model,
                "temperature": resolved_config.temperature,
                **env,
            },
        }

    @app.get("/agents")
    def list_agents() -> list[dict[str, Any]]:
        return registry().list_agents()

    @app.post("/sessions")
    def create_session() -> dict[str, Any]:
        reg = registry()
        session = RouterSession.new(reg)
        session_store.save(session)
        return {"session": session.to_dict()}

    @app.get("/sessions/{session_id}")
    def get_session(session_id: str) -> dict[str, Any]:
        try:
            return session_store.load(session_id).to_dict()
        except SessionError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @app.post("/sessions/{session_id}/active")
    def set_active(session_id: str, request: ActiveRequest) -> dict[str, Any]:
        try:
            reg = registry()
            session = session_store.load(session_id)
            parsed = parse_input("active " + " ".join(f"@{handle.removeprefix('@')}" for handle in request.handles))
            session.apply_input(parsed, reg)
            session_store.save(session)
            return session.to_dict()
        except (RegistryError, SessionError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/sessions/{session_id}/round")
    def run_round(session_id: str, request: RoundRequest) -> dict[str, Any]:
        try:
            reg = registry()
            session = session_store.load(session_id)
            parsed = parse_input(request.text)
            mentioned = session.apply_input(parsed, reg)
            plan = build_turn_plan(session, reg, mentioned)
            result = execute(session, reg, plan)
            session_store.save(session)
            return {"session": session.to_dict(), "round": result.to_dict()}
        except (RegistryError, SessionError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except LLMConfigurationError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    @app.post("/sessions/{session_id}/next")
    def next_round(session_id: str) -> dict[str, Any]:
        try:
            reg = registry()
            session = session_store.load(session_id)
            parsed = parse_input("next round")
            mentioned = session.apply_input(parsed, reg)
            plan = build_turn_plan(session, reg, mentioned)
            result = execute(session, reg, plan)
            session_store.save(session)
            return {"session": session.to_dict(), "round": result.to_dict()}
        except (RegistryError, SessionError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except LLMConfigurationError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    @app.get("/{spa_path:path}", include_in_schema=False)
    def spa_fallback(spa_path: str) -> FileResponse:
        if spa_path.startswith(("static/", "agents", "sessions", "health")):
            raise HTTPException(status_code=404, detail="Not found")
        index_path = web_dir / "index.html"
        if not index_path.exists():
            raise HTTPException(status_code=404, detail="Web UI is not packaged")
        return FileResponse(index_path)

    return app


app = create_app()
