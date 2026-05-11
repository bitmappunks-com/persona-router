#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT_FOR_IMPORT = Path(__file__).resolve().parents[1]
if str(ROOT_FOR_IMPORT) not in sys.path:
    sys.path.insert(0, str(ROOT_FOR_IMPORT))

from persona_router.commands import parse_input
from persona_router.executor import run_mock_round
from persona_router.planner import build_turn_plan
from persona_router.registry import load_registry
from persona_router.session import RouterSession


def main() -> int:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
    cases_path = root / "evals" / "router-cases.jsonl"
    registry = load_registry(
        [Path("examples/persona-registry.json"), Path("examples/community-persona-registry.json")],
        root=root,
    )
    session = RouterSession.new(registry, session_id="eval_session")
    failures: list[str] = []

    for line in cases_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        parsed = parse_input(case["input"])
        if parsed.intent != case["expected_intent"]:
            failures.append(f"{case['case_id']}: intent {parsed.intent} != {case['expected_intent']}")
            continue
        mentioned = session.apply_input(parsed, registry)
        if "expected_active" in case and session.active_agent_ids != case["expected_active"]:
            failures.append(f"{case['case_id']}: active {session.active_agent_ids} != {case['expected_active']}")
        if "expected_active_after" in case and session.active_agent_ids != case["expected_active_after"]:
            failures.append(f"{case['case_id']}: active {session.active_agent_ids} != {case['expected_active_after']}")
        if case["expected_intent"] in {"topic_with_mentions", "next_round"}:
            plan = build_turn_plan(session, registry, mentioned)
            result = run_mock_round(session, registry, plan)
            actual_agents = [turn["agent_id"] for turn in result.turns]
            actual_triggers = [turn["trigger"] for turn in result.turns]
            if "expected_round_agents" in case and actual_agents != case["expected_round_agents"]:
                failures.append(f"{case['case_id']}: round agents {actual_agents} != {case['expected_round_agents']}")
            if "expected_round_triggers" in case and actual_triggers != case["expected_round_triggers"]:
                failures.append(f"{case['case_id']}: triggers {actual_triggers} != {case['expected_round_triggers']}")
            if "expected_source_repository" in case:
                actual_source = result.turns[0]["metadata"]["source"].get("source_repository")
                if actual_source != case["expected_source_repository"]:
                    failures.append(f"{case['case_id']}: source {actual_source} != {case['expected_source_repository']}")
            if "expected_runtime_entrypoint" in case:
                actual_entrypoint = result.turns[0]["metadata"]["runtime_entrypoint"]
                if actual_entrypoint != case["expected_runtime_entrypoint"]:
                    failures.append(f"{case['case_id']}: entrypoint {actual_entrypoint} != {case['expected_runtime_entrypoint']}")
            if "expected_previous_turns_min" in case:
                previous_turns = result.turns[0]["metadata"]["prompts"]["developer"]["previous_turns"]
                if len(previous_turns) < case["expected_previous_turns_min"]:
                    failures.append(
                        f"{case['case_id']}: previous turns {len(previous_turns)} < {case['expected_previous_turns_min']}"
                    )
            if case.get("check_max_words"):
                for turn in result.turns:
                    agent = registry.get(turn["agent_id"])
                    max_words = int(agent.dialogue.get("max_words_per_turn", 260))
                    if len(turn["content"].split()) > max_words:
                        failures.append(f"{case['case_id']}: {agent.agent_id} exceeded max_words_per_turn")

    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1
    print("PASS router evals")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
