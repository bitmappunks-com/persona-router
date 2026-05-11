from __future__ import annotations

import json
from difflib import get_close_matches
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import jsonschema


class RegistryError(ValueError):
    """Raised when an agent registry is invalid."""


@dataclass(frozen=True)
class Agent:
    data: dict[str, Any]
    registry_path: Path

    @property
    def agent_id(self) -> str:
        return self.data["agent_id"]

    @property
    def handle(self) -> str:
        return self.data["handle"]

    @property
    def display_name(self) -> str:
        return self.data["display_name"]

    @property
    def enabled(self) -> bool:
        return bool(self.data.get("enabled", True))

    @property
    def aliases(self) -> list[str]:
        return list(self.data.get("activation", {}).get("aliases", []))

    @property
    def persona_ref(self) -> dict[str, Any]:
        return self.data["persona_ref"]

    @property
    def dialogue(self) -> dict[str, Any]:
        return self.data["dialogue"]

    @property
    def metadata(self) -> dict[str, Any]:
        return self.data.get("metadata", {})

    @property
    def source(self) -> dict[str, Any]:
        if "source" in self.data:
            return self.data["source"]
        metadata = self.metadata
        return {
            key: metadata[key]
            for key in ("source_repository", "source_commit", "source_index", "source_category", "license_status")
            if key in metadata
        }

    @property
    def risk_level(self) -> str:
        return self.data.get("risk_level", "medium")

    @property
    def domains(self) -> list[str]:
        return list(self.data.get("domains", []))

    def summary(self) -> dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "handle": self.handle,
            "display_name": self.display_name,
            "enabled": self.enabled,
            "aliases": self.aliases,
            "source": self.source,
            "risk_level": self.risk_level,
            "domains": self.domains,
            "persona_ref": self.persona_ref,
            "dialogue": self.dialogue,
            "metadata": self.metadata,
        }


@dataclass
class AgentRegistry:
    root: Path
    agents: dict[str, Agent]
    handles: dict[str, str]
    mention_activation_mode: str = "replace_for_topic"

    def list_agents(
        self,
        enabled_only: bool = True,
        domain: str | None = None,
        source: str | None = None,
        risk_level: str | None = None,
    ) -> list[dict[str, Any]]:
        values = sorted(self.agents.values(), key=lambda item: item.handle)
        if enabled_only:
            values = [agent for agent in values if agent.enabled]
        if domain:
            values = [agent for agent in values if domain in agent.domains]
        if source:
            values = [
                agent
                for agent in values
                if source in agent.source.get("source_category", "")
                or source in agent.source.get("source_repository", "")
                or source in agent.source.get("source_index", "")
            ]
        if risk_level:
            values = [agent for agent in values if agent.risk_level == risk_level]
        return [agent.summary() for agent in values]

    def get(self, agent_id: str) -> Agent:
        try:
            return self.agents[agent_id]
        except KeyError as exc:
            raise RegistryError(f"Unknown agent id: {agent_id}") from exc

    def resolve_handle(self, handle: str) -> Agent:
        normalized = normalize_handle(handle)
        try:
            return self.get(self.handles[normalized])
        except KeyError as exc:
            close_matches = ", ".join(f"@{item}" for item in self.suggest_handles(normalized, limit=4))
            available = ", ".join(f"@{item}" for item in self.suggest_handles(limit=8))
            detail = ""
            if close_matches:
                detail += f" Did you mean: {close_matches}?"
            if available:
                detail += f" Available handles include: {available}."
            raise RegistryError(f"Unknown agent handle: @{handle}.{detail}") from exc

    def suggest_handles(self, query: str | None = None, limit: int = 10) -> list[str]:
        visible = sorted(agent.handle for agent in self.agents.values() if agent.enabled)
        if not query:
            return visible[:limit]
        normalized = normalize_handle(query)
        candidates = sorted({*visible, *self.handles.keys()})
        prefix_matches = [item for item in candidates if item.startswith(normalized)]
        fuzzy_matches = get_close_matches(normalized, candidates, n=limit, cutoff=0.58)
        return dedupe([*prefix_matches, *fuzzy_matches])[:limit]


def normalize_handle(value: str) -> str:
    return value.strip().removeprefix("@").lower()


def dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value not in seen:
            result.append(value)
            seen.add(value)
    return result


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RegistryError(f"Missing JSON file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise RegistryError(f"Invalid JSON in {path}: {exc}") from exc


def load_registry(
    registry_paths: list[Path],
    root: Path | None = None,
    schema_path: Path | None = None,
) -> AgentRegistry:
    root = (root or Path.cwd()).resolve()
    schema_path = schema_path or root / "schemas" / "persona-agent.schema.json"
    schema = load_json(schema_path)

    agents: dict[str, Agent] = {}
    handles: dict[str, str] = {}
    mention_activation_mode = "replace_for_topic"

    for registry_path in registry_paths:
        resolved_path = (root / registry_path).resolve() if not registry_path.is_absolute() else registry_path
        data = load_json(resolved_path)
        jsonschema.Draft202012Validator(schema).validate(data)
        mention_activation_mode = data.get("default_mention_activation_mode", mention_activation_mode)

        for raw_agent in data["agents"]:
            agent = Agent(raw_agent, resolved_path)
            if agent.agent_id in agents:
                raise RegistryError(f"Duplicate agent_id: {agent.agent_id}")
            agents[agent.agent_id] = agent
            for handle in [agent.handle, *agent.aliases]:
                key = normalize_handle(handle)
                if key in handles:
                    other = handles[key]
                    if other == agent.agent_id:
                        continue
                    raise RegistryError(f"Duplicate handle or alias '{handle}' for {agent.agent_id} and {other}")
                handles[key] = agent.agent_id
            validate_persona_ref(root, agent)

    return AgentRegistry(root=root, agents=agents, handles=handles, mention_activation_mode=mention_activation_mode)


def validate_persona_ref(root: Path, agent: Agent) -> None:
    ref = agent.persona_ref
    ref_type = ref["type"]
    if ref_type in {"local_persona_package", "local_agent_skill"}:
        base_path = root / ref["path"]
        entrypoint = base_path / ref.get("entrypoint", "SKILL.md")
        if not entrypoint.exists():
            raise RegistryError(f"{agent.agent_id} missing entrypoint: {entrypoint}")
        if ref_type == "local_persona_package":
            persona_json = base_path / ref.get("persona_json", "persona.json")
            if not persona_json.exists():
                raise RegistryError(f"{agent.agent_id} missing persona_json: {persona_json}")
    elif ref_type == "inline_prompt":
        if not ref.get("prompt"):
            raise RegistryError(f"{agent.agent_id} inline_prompt has no prompt")
    elif ref_type == "remote_persona":
        if not ref.get("url"):
            raise RegistryError(f"{agent.agent_id} remote_persona has no url")


def default_registry_paths(root: Path) -> list[Path]:
    paths = [Path("examples/persona-registry.json")]
    community = root / "examples" / "community-persona-registry.json"
    if community.exists():
        paths.append(Path("examples/community-persona-registry.json"))
    local = root / "agents.local.json"
    if local.exists():
        paths.append(Path("agents.local.json"))
    return paths
