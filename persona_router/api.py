from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Iterator

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .commands import parse_input
from .executor import (
    LLMClient,
    LLMConfig,
    run_llm_round,
    run_llm_round_stream,
    run_mock_round,
)
from .llm import LLMConfigurationError, build_default_client, diagnose_llm_environment
from .planner import build_turn_plan
from .registry import RegistryError, default_registry_paths, load_registry
from .session import RouterSession, SessionError
from .store import JsonFileSessionStore, SessionStore


class ActiveRequest(BaseModel):
    handles: list[str]


class RoundRequest(BaseModel):
    text: str


class CreateSessionRequest(BaseModel):
    kind: str | None = None
    name: str | None = None
    handles: list[str] | None = None


class PatchSessionRequest(BaseModel):
    name: str | None = None
    archived: bool | None = None


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
    def create_session(request: CreateSessionRequest | None = None) -> dict[str, Any]:
        reg = registry()
        kind = (request.kind if request else None) or "group"
        if kind not in {"group", "direct"}:
            raise HTTPException(status_code=400, detail=f"Unknown kind: {kind}")
        name = request.name if request else None
        handles = request.handles if request else None

        active_agent_ids: list[str] | None = None
        direct_handle: str | None = None
        if handles is not None:
            try:
                resolved = [reg.resolve_handle(handle).agent_id for handle in handles]
            except RegistryError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            # always include any default-active host agent (dispatcher)
            host_ids = [
                aid
                for aid, ag in reg.agents.items()
                if ag.enabled
                and isinstance(ag.dialogue, dict)
                and ag.dialogue.get("role") == "host"
                and ag.data.get("activation", {}).get("default_active", False)
            ]
            seen: set[str] = set()
            active_agent_ids = []
            for aid in [*host_ids, *resolved]:
                if aid in seen:
                    continue
                seen.add(aid)
                active_agent_ids.append(aid)

        session = RouterSession.new(
            reg,
            kind=kind,
            direct_handle=direct_handle,
            name=name,
            active_agent_ids=active_agent_ids,
        )
        session_store.save(session)
        return {"session": session.to_dict()}

    @app.post("/sessions/direct/{handle}")
    def open_direct_session(handle: str) -> dict[str, Any]:
        reg = registry()
        try:
            agent = reg.resolve_handle(handle)
        except RegistryError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        if agent.handle == "dispatcher":
            raise HTTPException(status_code=400, detail="Cannot open a direct chat with the dispatcher")
        target_id = f"direct_{agent.handle}"
        try:
            session = session_store.load(target_id)
            return {"session": session.to_dict(), "created": False}
        except SessionError:
            pass
        # build active list: dispatcher (if default_active host) + the persona
        host_ids = [
            aid
            for aid, ag in reg.agents.items()
            if ag.enabled
            and isinstance(ag.dialogue, dict)
            and ag.dialogue.get("role") == "host"
            and ag.data.get("activation", {}).get("default_active", False)
        ]
        active_ids = [*host_ids]
        if agent.agent_id not in active_ids:
            active_ids.append(agent.agent_id)
        session = RouterSession.new(
            reg,
            session_id=target_id,
            kind="direct",
            direct_handle=agent.handle,
            name=agent.display_name,
            active_agent_ids=active_ids,
        )
        session_store.save(session)
        return {"session": session.to_dict(), "created": True}

    @app.get("/sessions")
    def list_sessions() -> list[dict[str, Any]]:
        return session_store.list()

    @app.patch("/sessions/{session_id}")
    def patch_session(session_id: str, request: PatchSessionRequest) -> dict[str, Any]:
        try:
            session = session_store.load(session_id)
        except SessionError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        if request.name is not None:
            session.name = request.name.strip() or None
        if request.archived is not None:
            session.archived = bool(request.archived)
        session_store.save(session)
        return session.to_dict()

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

    def _stream_events(events: Iterator[dict[str, Any]]) -> Iterator[bytes]:
        for payload in events:
            event_name = payload.get("event", "message")
            data = json.dumps(payload, ensure_ascii=False)
            yield f"event: {event_name}\ndata: {data}\n\n".encode("utf-8")

    def _stream_round(session_id: str, parsed_text: str | None) -> StreamingResponse:
        try:
            reg = registry()
            session = session_store.load(session_id)
            parsed = parse_input(parsed_text if parsed_text is not None else "next round")
            mentioned = session.apply_input(parsed, reg)
            plan = build_turn_plan(session, reg, mentioned)
        except (RegistryError, SessionError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        if resolved_client is None or not hasattr(resolved_client, "stream"):
            raise HTTPException(
                status_code=503,
                detail="Streaming requires an LLM client with stream support. Configure DEEPSEEK_API_KEY or OPENAI_API_KEY.",
            )

        streaming_client = resolved_client

        def iterator() -> Iterator[bytes]:
            try:
                events = run_llm_round_stream(session, reg, plan, streaming_client, resolved_config)  # type: ignore[arg-type]
                for chunk in _stream_events(events):
                    yield chunk
                session_store.save(session)
                yield from _stream_events(iter([{"event": "session", "session": session.to_dict()}]))
            except LLMConfigurationError as exc:
                yield from _stream_events(iter([{"event": "error", "detail": str(exc)}]))
            except (RegistryError, SessionError, ValueError) as exc:
                yield from _stream_events(iter([{"event": "error", "detail": str(exc)}]))

        return StreamingResponse(iterator(), media_type="text/event-stream")

    @app.post("/sessions/{session_id}/round/stream")
    def run_round_stream(session_id: str, request: RoundRequest) -> StreamingResponse:
        return _stream_round(session_id, request.text)

    @app.post("/sessions/{session_id}/next/stream")
    def next_round_stream(session_id: str) -> StreamingResponse:
        return _stream_round(session_id, None)

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
