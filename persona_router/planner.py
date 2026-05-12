from __future__ import annotations

from dataclasses import dataclass

from .registry import AgentRegistry
from .session import RouterSession, dedupe


@dataclass(frozen=True)
class TurnPlanItem:
    agent_id: str
    trigger: str

    def to_dict(self) -> dict[str, str]:
        return {"agent_id": self.agent_id, "trigger": self.trigger}


@dataclass(frozen=True)
class TurnPlan:
    round_index: int
    topic: str
    items: list[TurnPlanItem]
    allow_cross_questions: bool = True

    def to_dict(self) -> dict[str, object]:
        return {
            "schema_version": "0.1.0",
            "round_index": self.round_index,
            "topic": self.topic,
            "allow_cross_questions": self.allow_cross_questions,
            "items": [item.to_dict() for item in self.items],
        }


def build_turn_plan(
    session: RouterSession,
    registry: AgentRegistry,
    mentioned_agent_ids: list[str] | None = None,
    max_agents_per_round: int | None = None,
    allow_cross_questions: bool = True,
) -> TurnPlan:
    mentioned_agent_ids = mentioned_agent_ids or []
    active = list(session.active_agent_ids)
    ordered_ids = dedupe([*mentioned_agent_ids, *active])
    hosts: list[TurnPlanItem] = []
    participants: list[TurnPlanItem] = []
    moderators: list[TurnPlanItem] = []

    for agent_id in ordered_ids:
        agent = registry.get(agent_id)
        policy = agent.dialogue["turn_policy"]
        role = agent.dialogue["role"]
        mentioned = agent_id in mentioned_agent_ids
        active_now = agent_id in active
        if policy == "speak_only_when_mentioned" and not mentioned:
            continue
        if role == "host":
            if mentioned or active_now:
                hosts.append(TurnPlanItem(agent_id=agent_id, trigger="host"))
            continue
        if policy == "moderate_after_participants" or role in {"moderator", "summarizer"}:
            if mentioned or active_now:
                moderators.append(TurnPlanItem(agent_id=agent_id, trigger="moderator"))
            continue
        if mentioned or active_now:
            participants.append(TurnPlanItem(agent_id=agent_id, trigger="mentioned" if mentioned else "active"))

    items = [*hosts, *participants, *moderators]
    if max_agents_per_round is not None:
        items = items[:max_agents_per_round]
    if not items:
        raise ValueError("No active or mentioned agents available for this round")
    if not session.topic:
        raise ValueError("No topic set for this round")
    return TurnPlan(
        round_index=session.round_index + 1,
        topic=session.topic,
        items=items,
        allow_cross_questions=allow_cross_questions,
    )
