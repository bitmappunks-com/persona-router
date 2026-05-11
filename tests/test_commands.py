from __future__ import annotations

from persona_router.commands import parse_input


def test_parse_active_command() -> None:
    parsed = parse_input("active @feynman @steve_jobs")
    assert parsed.intent == "set_active"
    assert parsed.mentioned_handles == ["feynman", "steve_jobs"]


def test_parse_topic_with_mentions() -> None:
    parsed = parse_input("@feynman @steve_jobs 讨论一下产品发布会为什么容易变成形式主义")
    assert parsed.intent == "topic_with_mentions"
    assert parsed.mentioned_handles == ["feynman", "steve_jobs"]
    assert parsed.topic == "讨论一下产品发布会为什么容易变成形式主义"


def test_parse_next_round_chinese() -> None:
    parsed = parse_input("再讨论一轮")
    assert parsed.intent == "next_round"
    assert parsed.round_instruction == "再讨论一轮"


def test_parse_list_agents_chinese() -> None:
    parsed = parse_input("有哪些 agent")
    assert parsed.intent == "list_agents"

