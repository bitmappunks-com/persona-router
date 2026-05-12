from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterator, Protocol

from .boundaries import assess_boundaries
from .planner import TurnPlan
from .registry import AgentRegistry
from .runtime_loader import load_runtime_uncached
from .session import RouterSession

GLOBAL_BOUNDARIES = [
    "Use persona output as a reasoning perspective, not as a real identity claim.",
    "Do not claim private thoughts, private memories, internal actions, or live decisions.",
    "Downgrade high-risk medical, legal, financial, or safety advice to general principles.",
]


@dataclass(frozen=True)
class RoundResult:
    round_index: int
    turns: list[dict[str, object]]
    needs_verification: bool = False
    boundary_downgraded: bool = False

    def to_dict(self) -> dict[str, object]:
        return {
            "schema_version": "0.1.0",
            "round_index": self.round_index,
            "needs_verification": self.needs_verification,
            "boundary_downgraded": self.boundary_downgraded,
            "turns": self.turns,
        }


@dataclass(frozen=True)
class LLMConfig:
    model: str = "default"
    temperature: float = 0.2


class LLMClient(Protocol):
    def complete(self, system: str, developer: dict[str, Any], model: str, temperature: float) -> str:
        """Return one agent turn for the provided prompt bundle."""


class StreamingLLMClient(LLMClient, Protocol):
    def stream(
        self,
        system: str,
        developer: dict[str, Any],
        model: str,
        temperature: float,
    ) -> Iterator[str]:
        """Yield text deltas for one agent turn."""


def run_mock_round(session: RouterSession, registry: AgentRegistry, plan: TurnPlan) -> RoundResult:
    boundary = assess_boundaries(plan.topic)
    turns: list[dict[str, object]] = []
    for item in plan.items:
        agent = registry.get(item.agent_id)
        runtime = load_runtime_uncached(registry.root, agent)
        source = {**agent.source, **runtime.source}
        prompts = build_prompt_bundle(
            agent.display_name,
            agent.handle,
            runtime.name,
            runtime.skill_text_excerpt,
            runtime.boundaries,
            plan.topic,
            plan.allow_cross_questions,
            session.turns,
        )
        content = build_mock_content(
            agent.display_name,
            agent.handle,
            runtime.name,
            plan.topic,
            item.trigger,
            source,
            boundary.needs_verification,
            boundary.should_downgrade,
        )
        content = limit_words(content, int(agent.dialogue.get("max_words_per_turn", 260)))
        metadata = {
            "mock": True,
            "boundary": boundary.to_dict(),
            "prompts": prompts,
            "runtime_kind": runtime.kind,
            "runtime_entrypoint": runtime.entrypoint,
            "runtime_path": str(runtime.path) if runtime.path else None,
            "source": source,
        }
        session.append_turn(plan.round_index, item.agent_id, item.trigger, content, metadata)
        turns.append(
            {
                "round_index": plan.round_index,
                "agent_id": item.agent_id,
                "handle": agent.handle,
                "trigger": item.trigger,
                "content": content,
                "metadata": metadata,
            }
        )
    session.round_index = plan.round_index
    return RoundResult(
        round_index=plan.round_index,
        turns=turns,
        needs_verification=boundary.needs_verification,
        boundary_downgraded=boundary.should_downgrade or boundary.needs_verification,
    )


def run_llm_round(
    session: RouterSession,
    registry: AgentRegistry,
    plan: TurnPlan,
    client: LLMClient,
    config: LLMConfig | None = None,
) -> RoundResult:
    config = config or LLMConfig()
    boundary = assess_boundaries(plan.topic)
    turns: list[dict[str, object]] = []
    host_brief: str | None = None
    members_directory = _members_directory(plan, registry)
    for item in plan.items:
        agent = registry.get(item.agent_id)
        runtime = load_runtime_uncached(registry.root, agent)
        source = {**agent.source, **runtime.source}
        is_host = item.trigger == "host"
        others = [m for m in members_directory if m["handle"] != agent.handle]
        prompts = build_prompt_bundle(
            agent.display_name,
            agent.handle,
            runtime.name,
            runtime.skill_text_excerpt,
            runtime.boundaries,
            plan.topic,
            plan.allow_cross_questions,
            session.turns,
            host_brief=None if is_host else host_brief,
            other_members=others,
        )
        content = client.complete(
            system=str(prompts["system"]),
            developer=prompts["developer"],
            model=config.model,
            temperature=config.temperature,
        )
        content = limit_words(content, int(agent.dialogue.get("max_words_per_turn", 260)))
        if is_host:
            host_brief = content
        metadata = {
            "mock": False,
            "boundary": boundary.to_dict(),
            "prompts": prompts,
            "runtime_kind": runtime.kind,
            "runtime_entrypoint": runtime.entrypoint,
            "runtime_path": str(runtime.path) if runtime.path else None,
            "source": source,
            "model": config.model,
            "temperature": config.temperature,
            "role": "host" if is_host else None,
        }
        session.append_turn(plan.round_index, item.agent_id, item.trigger, content, metadata)
        turns.append(
            {
                "round_index": plan.round_index,
                "agent_id": item.agent_id,
                "handle": agent.handle,
                "trigger": item.trigger,
                "content": content,
                "metadata": metadata,
            }
        )
    session.round_index = plan.round_index
    return RoundResult(
        round_index=plan.round_index,
        turns=turns,
        needs_verification=boundary.needs_verification,
        boundary_downgraded=boundary.should_downgrade or boundary.needs_verification,
    )


def run_llm_round_stream(
    session: RouterSession,
    registry: AgentRegistry,
    plan: TurnPlan,
    client: StreamingLLMClient,
    config: LLMConfig | None = None,
) -> Iterator[dict[str, Any]]:
    """Yield event dicts for a round, streaming each agent's tokens.

    Event shapes:
        {"event": "round_start", "round_index": N, "topic": "..."}
        {"event": "turn_start", "agent_id": "...", "handle": "...", "display_name": "...", "trigger": "..."}
        {"event": "token", "agent_id": "...", "delta": "..."}
        {"event": "turn_end", "agent_id": "...", "content": "...", "metadata": {...}}
        {"event": "round_end", "round_index": N, "needs_verification": bool, "boundary_downgraded": bool}
    """
    config = config or LLMConfig()
    boundary = assess_boundaries(plan.topic)
    yield {"event": "round_start", "round_index": plan.round_index, "topic": plan.topic}
    completed_turns: list[dict[str, Any]] = []
    host_brief: str | None = None
    members_directory = _members_directory(plan, registry)

    for item in plan.items:
        agent = registry.get(item.agent_id)
        runtime = load_runtime_uncached(registry.root, agent)
        source = {**agent.source, **runtime.source}
        is_host = item.trigger == "host"
        others = [m for m in members_directory if m["handle"] != agent.handle]
        prompts = build_prompt_bundle(
            agent.display_name,
            agent.handle,
            runtime.name,
            runtime.skill_text_excerpt,
            runtime.boundaries,
            plan.topic,
            plan.allow_cross_questions,
            session.turns,
            host_brief=None if is_host else host_brief,
            other_members=others,
        )
        yield {
            "event": "turn_start",
            "agent_id": item.agent_id,
            "handle": agent.handle,
            "display_name": agent.display_name,
            "trigger": item.trigger,
            "role": "host" if is_host else "participant",
        }
        buffer: list[str] = []
        for chunk in client.stream(
            system=str(prompts["system"]),
            developer=prompts["developer"],
            model=config.model,
            temperature=config.temperature,
        ):
            if not chunk:
                continue
            buffer.append(chunk)
            yield {"event": "token", "agent_id": item.agent_id, "delta": chunk}
        content = "".join(buffer).strip()
        content = limit_words(content, int(agent.dialogue.get("max_words_per_turn", 260)))
        if is_host:
            host_brief = content
        metadata = {
            "mock": False,
            "boundary": boundary.to_dict(),
            "prompts": prompts,
            "runtime_kind": runtime.kind,
            "runtime_entrypoint": runtime.entrypoint,
            "runtime_path": str(runtime.path) if runtime.path else None,
            "source": source,
            "model": config.model,
            "temperature": config.temperature,
            "streamed": True,
            "role": "host" if is_host else None,
        }
        session.append_turn(plan.round_index, item.agent_id, item.trigger, content, metadata)
        turn_payload = {
            "round_index": plan.round_index,
            "agent_id": item.agent_id,
            "handle": agent.handle,
            "trigger": item.trigger,
            "content": content,
            "metadata": metadata,
        }
        completed_turns.append(turn_payload)
        yield {"event": "turn_end", **turn_payload}

    session.round_index = plan.round_index
    yield {
        "event": "round_end",
        "round_index": plan.round_index,
        "needs_verification": boundary.needs_verification,
        "boundary_downgraded": boundary.should_downgrade or boundary.needs_verification,
        "turns": completed_turns,
    }


def build_mock_content(
    display_name: str,
    handle: str,
    runtime_name: str,
    topic: str,
    trigger: str,
    source: dict[str, object],
    needs_verification: bool,
    should_downgrade: bool,
) -> str:
    source_text = ""
    upstream = (source.get("upstream_repository") or source.get("source_repository")) if source else None
    if upstream:
        source_text = f" Source: {upstream}."
    boundary_text = build_boundary_note(needs_verification, should_downgrade)
    return (
        f"[mock @{handle} / {display_name}] Trigger={trigger}. "
        f"Runtime={runtime_name}. Topic={topic}. "
        "Real LLM execution is not enabled in this mock executor; this turn proves routing, session state, and runtime loading."
        f"{boundary_text}"
        f"{source_text}"
    )


def apply_boundary_note(text: str, needs_verification: bool, should_downgrade: bool) -> str:
    note = build_boundary_note(needs_verification, should_downgrade)
    return f"{text}{note}" if note else text


def build_boundary_note(needs_verification: bool, should_downgrade: bool) -> str:
    boundary_text = ""
    if needs_verification:
        boundary_text += " Boundary: current or factual claims require external verification before a concrete answer."
    if should_downgrade:
        boundary_text += " Boundary: request is downgraded to general, non-authoritative guidance."
    return boundary_text


def build_prompt_bundle(
    display_name: str,
    handle: str,
    runtime_name: str,
    skill_excerpt: str,
    runtime_boundaries: list[str],
    topic: str,
    allow_cross_questions: bool,
    previous_turns: list[dict[str, object]],
    host_brief: str | None = None,
    other_members: list[dict[str, str]] | None = None,
) -> dict[str, object]:
    boundaries = [*GLOBAL_BOUNDARIES, *runtime_boundaries]
    system = (
        f"You are @{handle} ({display_name}) using runtime '{runtime_name}'. "
        "Stay within the merged boundaries and answer only for the assigned turn."
    )
    if host_brief:
        system += (
            " The group dispatcher (host) has already framed this round. Read the host_brief, "
            f"find the line addressed to @{handle} for your assigned angle, and answer from that angle."
        )
    developer: dict[str, object] = {
        "topic": topic,
        "boundaries": boundaries,
        "skill_excerpt": skill_excerpt,
        "allow_cross_questions": allow_cross_questions,
        "previous_turns": previous_turns[-8:],
    }
    if host_brief:
        developer["host_brief"] = host_brief
    if other_members:
        developer["other_members"] = other_members
    return {"system": system, "developer": developer}


def _members_directory(plan: TurnPlan, registry: AgentRegistry) -> list[dict[str, str]]:
    members: list[dict[str, str]] = []
    for item in plan.items:
        try:
            agent = registry.get(item.agent_id)
        except Exception:
            continue
        members.append(
            {
                "handle": agent.handle,
                "display_name": agent.display_name,
                "stance": agent.dialogue.get("stance", "") if isinstance(agent.dialogue, dict) else "",
                "domains": " · ".join(agent.domains),
                "role": agent.dialogue.get("role", "participant") if isinstance(agent.dialogue, dict) else "participant",
            }
        )
    return members


def limit_words(text: str, max_words: int) -> str:
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words])
