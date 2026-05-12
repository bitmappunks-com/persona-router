from __future__ import annotations

from pathlib import Path

from persona_router.commands import parse_input
from persona_router.executor import LLMConfig, run_llm_round, run_mock_round
from persona_router.planner import build_turn_plan
from persona_router.registry import Agent, AgentRegistry, load_registry
from persona_router.session import RouterSession


ROOT = Path(__file__).resolve().parents[2]


def load_test_registry():
    return load_registry(
        [Path("persona_router/registries/local.json"), Path("persona_router/registries/imported.json")],
        root=ROOT,
    )


def test_topic_mentions_set_active_and_plan_order() -> None:
    registry = load_test_registry()
    session = RouterSession.new(registry, session_id="sess_test")
    parsed = parse_input("@feynman @steve_jobs 讨论产品发布")
    mentioned = session.apply_input(parsed, registry)
    assert session.active_agent_ids == ["community_feynman", "community_steve_jobs"]
    assert session.topic == "讨论产品发布"

    plan = build_turn_plan(session, registry, mentioned)
    assert plan.round_index == 1
    assert [item.agent_id for item in plan.items] == ["community_feynman", "community_steve_jobs"]
    assert [item.trigger for item in plan.items] == ["mentioned", "mentioned"]


def test_mock_round_appends_turns_and_next_round_uses_active_agents() -> None:
    registry = load_test_registry()
    session = RouterSession.new(registry, session_id="sess_test")
    mentioned = session.apply_input(parse_input("@feynman @steve_jobs 讨论产品发布"), registry)
    result = run_mock_round(session, registry, build_turn_plan(session, registry, mentioned))

    assert result.round_index == 1
    assert len(session.turns) == 2
    assert session.round_index == 1
    assert "Real LLM execution is not enabled" in session.turns[0]["content"]
    prompts = session.turns[0]["metadata"]["prompts"]
    assert "system" in prompts
    assert "developer" in prompts
    assert prompts["developer"]["boundaries"]
    assert session.turns[0]["metadata"]["source"]["license_status"] == "license_present"

    mentioned = session.apply_input(parse_input("再讨论一轮"), registry)
    next_result = run_mock_round(session, registry, build_turn_plan(session, registry, mentioned))
    assert next_result.round_index == 2
    assert [turn["trigger"] for turn in next_result.turns] == ["active", "active"]
    assert len(next_result.turns[0]["metadata"]["prompts"]["developer"]["previous_turns"]) == 2
    assert len(session.turns) == 4


def test_deactivate_removes_agent_from_next_round() -> None:
    registry = load_test_registry()
    session = RouterSession.new(registry, session_id="sess_test")
    session.apply_input(parse_input("@feynman @steve_jobs 讨论产品发布"), registry)
    session.apply_input(parse_input("deactivate @steve_jobs"), registry)
    assert session.active_agent_ids == ["community_feynman"]


def test_planner_can_limit_agents_per_round() -> None:
    registry = load_test_registry()
    session = RouterSession.new(registry, session_id="sess_test")
    mentioned = session.apply_input(parse_input("@feynman @steve_jobs 讨论产品发布"), registry)
    plan = build_turn_plan(session, registry, mentioned, max_agents_per_round=1)
    assert [item.agent_id for item in plan.items] == ["community_feynman"]


def test_planner_preserves_mixed_participant_critic_moderator_order() -> None:
    registry = AgentRegistry(
        root=ROOT,
        agents={
            "participant": fake_agent("participant", "participant", "participant", "speak_when_active_or_mentioned"),
            "critic": fake_agent("critic", "critic", "critic", "speak_only_when_mentioned"),
            "moderator": fake_agent("moderator", "moderator", "moderator", "moderate_after_participants"),
        },
        handles={"participant": "participant", "critic": "critic", "moderator": "moderator"},
    )
    session = RouterSession(
        session_id="sess_mixed",
        available_agent_ids=["participant", "critic", "moderator"],
        active_agent_ids=["moderator", "participant", "critic"],
        mention_activation_mode="replace_for_topic",
        topic="讨论一个复杂决策",
    )

    plan = build_turn_plan(
        session,
        registry,
        mentioned_agent_ids=["critic", "moderator"],
        allow_cross_questions=False,
    )

    assert plan.allow_cross_questions is False
    assert [item.agent_id for item in plan.items] == ["critic", "participant", "moderator"]
    assert [item.trigger for item in plan.items] == ["mentioned", "active", "moderator"]


def test_fact_gate_adds_explicit_downgrade_text() -> None:
    registry = load_test_registry()
    session = RouterSession.new(registry, session_id="sess_test")
    mentioned = session.apply_input(parse_input("@feynman 今天英伟达股价可以买入吗？"), registry)
    result = run_mock_round(session, registry, build_turn_plan(session, registry, mentioned))

    assert result.needs_verification
    assert result.boundary_downgraded
    assert "require external verification" in result.turns[0]["content"]


def test_llm_executor_uses_independent_agent_prompts_and_config() -> None:
    registry = load_test_registry()
    session = RouterSession.new(registry, session_id="sess_test")
    mentioned = session.apply_input(parse_input("@feynman @steve_jobs 讨论产品发布"), registry)
    client = FakeLLMClient()

    result = run_llm_round(
        session,
        registry,
        build_turn_plan(session, registry, mentioned),
        client,
        LLMConfig(model="test-model", temperature=0.4),
    )

    assert [call["model"] for call in client.calls] == ["test-model", "test-model"]
    assert [call["temperature"] for call in client.calls] == [0.4, 0.4]
    assert "@feynman" in client.calls[0]["system"]
    assert "@steve_jobs" in client.calls[1]["system"]
    assert client.calls[0]["developer"]["previous_turns"] == []
    assert result.turns[0]["metadata"]["mock"] is False

    mentioned = session.apply_input(parse_input("再讨论一轮"), registry)
    run_llm_round(session, registry, build_turn_plan(session, registry, mentioned), client, LLMConfig(model="test-model"))
    assert len(client.calls[-1]["developer"]["previous_turns"]) >= 2


def fake_agent(agent_id: str, handle: str, role: str, turn_policy: str) -> Agent:
    return Agent(
        data={
            "agent_id": agent_id,
            "handle": handle,
            "display_name": handle.title(),
            "enabled": True,
            "activation": {"allow_manual_toggle": True, "aliases": []},
            "persona_ref": {"type": "inline_prompt", "prompt": f"{handle} prompt"},
            "dialogue": {
                "role": role,
                "stance": "",
                "turn_policy": turn_policy,
                "max_words_per_turn": 120,
            },
        },
        registry_path=ROOT / "memory.json",
    )


class FakeLLMClient:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def complete(self, system: str, developer: dict[str, object], model: str, temperature: float) -> str:
        self.calls.append(
            {
                "system": system,
                "developer": developer,
                "model": model,
                "temperature": temperature,
            }
        )
        return f"answer from {system.split()[2]}"
