from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from .commands import ParsedInput
from .registry import AgentRegistry, RegistryError


class SessionError(ValueError):
    """Raised when a session state transition is invalid."""


@dataclass
class RouterSession:
    session_id: str
    available_agent_ids: list[str]
    active_agent_ids: list[str]
    mention_activation_mode: str
    topic: str | None = None
    last_user_input: str | None = None
    active_policy: str = "explicit_active_first"
    round_index: int = 0
    turns: list[dict[str, Any]] = field(default_factory=list)
    artifacts: list[dict[str, Any]] = field(default_factory=list)
    kind: str = "group"
    name: str | None = None
    direct_handle: str | None = None
    archived: bool = False

    @classmethod
    def new(
        cls,
        registry: AgentRegistry,
        session_id: str | None = None,
        *,
        kind: str = "group",
        direct_handle: str | None = None,
        name: str | None = None,
        active_agent_ids: list[str] | None = None,
    ) -> "RouterSession":
        enabled = [agent.agent_id for agent in registry.agents.values() if agent.enabled]
        default_active = [
            agent.agent_id
            for agent in registry.agents.values()
            if agent.enabled and agent.data.get("activation", {}).get("default_active")
        ]
        active = list(active_agent_ids) if active_agent_ids is not None else default_active
        return cls(
            session_id=session_id or f"sess_{uuid4().hex[:12]}",
            available_agent_ids=enabled,
            active_agent_ids=active,
            mention_activation_mode=registry.mention_activation_mode,
            kind=kind,
            direct_handle=direct_handle,
            name=name,
        )

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "RouterSession":
        return cls(
            session_id=data["session_id"],
            topic=data.get("topic"),
            last_user_input=data.get("last_user_input"),
            active_policy=data.get("active_policy", "explicit_active_first"),
            available_agent_ids=list(data["available_agent_ids"]),
            active_agent_ids=list(data["active_agent_ids"]),
            mention_activation_mode=data["mention_activation_mode"],
            round_index=int(data["round_index"]),
            turns=list(data["turns"]),
            artifacts=list(data.get("artifacts", [])),
            kind=data.get("kind", "group"),
            name=data.get("name"),
            direct_handle=data.get("direct_handle"),
            archived=bool(data.get("archived", False)),
        )

    def to_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "schema_version": "0.1.0",
            "session_id": self.session_id,
            "available_agent_ids": self.available_agent_ids,
            "active_agent_ids": self.active_agent_ids,
            "mention_activation_mode": self.mention_activation_mode,
            "round_index": self.round_index,
            "turns": self.turns,
            "kind": self.kind,
        }
        if self.name:
            data["name"] = self.name
        if self.direct_handle:
            data["direct_handle"] = self.direct_handle
        if self.archived:
            data["archived"] = True
        if self.topic:
            data["topic"] = self.topic
        if self.last_user_input:
            data["last_user_input"] = self.last_user_input
        data["active_policy"] = self.active_policy
        if self.artifacts:
            data["artifacts"] = self.artifacts
        return data

    def set_active(self, agent_ids: list[str], registry: AgentRegistry) -> None:
        self._validate_agents(agent_ids, registry, require_toggle=True)
        self.active_agent_ids = dedupe(agent_ids)

    def activate(self, agent_ids: list[str], registry: AgentRegistry) -> None:
        self._validate_agents(agent_ids, registry, require_toggle=True)
        self.active_agent_ids = dedupe([*self.active_agent_ids, *agent_ids])

    def deactivate(self, agent_ids: list[str], registry: AgentRegistry) -> None:
        self._validate_agents(agent_ids, registry, require_toggle=True)
        remove = set(agent_ids)
        self.active_agent_ids = [agent_id for agent_id in self.active_agent_ids if agent_id not in remove]

    def apply_input(self, parsed: ParsedInput, registry: AgentRegistry) -> list[str]:
        self.last_user_input = parsed.raw_text
        mentioned_ids = [registry.resolve_handle(handle).agent_id for handle in parsed.mentioned_handles]
        if parsed.topic:
            self.topic = parsed.topic

        if parsed.intent == "set_active":
            self.set_active(mentioned_ids, registry)
        elif parsed.intent == "activate":
            self.activate(mentioned_ids, registry)
        elif parsed.intent == "deactivate":
            self.deactivate(mentioned_ids, registry)
        elif parsed.intent == "topic_with_mentions":
            if self.mention_activation_mode == "replace_for_topic":
                self.set_active(mentioned_ids, registry)
            elif self.mention_activation_mode == "add_for_topic":
                self.activate(mentioned_ids, registry)
            elif self.mention_activation_mode == "single_turn_only":
                self._validate_agents(mentioned_ids, registry, require_toggle=False)
        return mentioned_ids

    def append_turn(self, round_index: int, agent_id: str, trigger: str, content: str, metadata: dict[str, Any] | None = None) -> None:
        self.turns.append(
            {
                "round_index": round_index,
                "agent_id": agent_id,
                "trigger": trigger,
                "content": content,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "metadata": metadata or {},
            }
        )

    def _validate_agents(self, agent_ids: list[str], registry: AgentRegistry, require_toggle: bool) -> None:
        for agent_id in agent_ids:
            if agent_id not in self.available_agent_ids:
                raise SessionError(f"Agent is not available in this session: {agent_id}")
            agent = registry.get(agent_id)
            if not agent.enabled:
                raise SessionError(f"Agent is disabled: {agent_id}")
            if require_toggle and not agent.data.get("activation", {}).get("allow_manual_toggle", True):
                raise SessionError(f"Agent does not allow manual toggle: {agent_id}")


def dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value not in seen:
            result.append(value)
            seen.add(value)
    return result


def load_session(path: Path) -> RouterSession:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SessionError(f"Missing session: {path}") from exc
    except json.JSONDecodeError as exc:
        raise SessionError(f"Invalid session JSON: {path}: {exc}") from exc
    return RouterSession.from_dict(data)


def save_session(session: RouterSession, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(session.to_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def session_path(root: Path, session_id: str) -> Path:
    return root / ".persona-router" / "sessions" / f"{session_id}.json"
