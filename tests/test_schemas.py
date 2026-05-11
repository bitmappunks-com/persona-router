from __future__ import annotations

import json
from pathlib import Path

import jsonschema
import pytest

from persona_router.commands import parse_input
from persona_router.executor import run_mock_round
from persona_router.planner import build_turn_plan
from persona_router.registry import load_registry
from persona_router.runtime_loader import RuntimeLoadError, load_persona_json, load_runtime_uncached
from persona_router.session import RouterSession


ROOT = Path(__file__).resolve().parents[1]


def load_schema(name: str) -> dict:
    return json.loads((ROOT / "schemas" / name).read_text(encoding="utf-8"))


def test_example_json_files_validate_against_schemas() -> None:
    agent_schema = load_schema("persona-agent.schema.json")
    session_schema = load_schema("persona-session.schema.json")
    for path in [ROOT / "examples" / "persona-registry.json", ROOT / "examples" / "community-persona-registry.json"]:
        jsonschema.Draft202012Validator(agent_schema).validate(json.loads(path.read_text(encoding="utf-8")))
    jsonschema.Draft202012Validator(session_schema).validate(
        json.loads((ROOT / "examples" / "session-state.json").read_text(encoding="utf-8"))
    )


def test_turn_plan_and_round_result_validate_against_schemas() -> None:
    registry = load_registry(
        [Path("examples/persona-registry.json"), Path("examples/community-persona-registry.json")],
        root=ROOT,
    )
    session = RouterSession.new(registry, session_id="sess_schema")
    mentioned = session.apply_input(parse_input("@feynman @steve_jobs 讨论产品发布"), registry)
    plan = build_turn_plan(session, registry, mentioned)
    result = run_mock_round(session, registry, plan)

    jsonschema.Draft202012Validator(load_schema("turn-plan.schema.json")).validate(plan.to_dict())
    jsonschema.Draft202012Validator(load_schema("round-result.schema.json")).validate(result.to_dict())


def test_local_persona_package_runtime_loads_structured_assets() -> None:
    registry = load_registry([Path("examples/persona-registry.json")], root=ROOT)
    runtime = load_runtime_uncached(ROOT, registry.resolve_handle("buffett"))
    assert runtime.kind == "local_persona_package"
    assert "persona_json" in runtime.assets
    assert runtime.assets["persona_json"]["persona_id"] == "warren-buffett-perspective"
    if "case_count" in runtime.assets:
        assert runtime.assets["case_count"] >= 1


def test_local_persona_package_validates_optional_evidence_refs(tmp_path: Path) -> None:
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    (corpus / "excerpts.jsonl").write_text('{"excerpt_id":"ex_known"}\n', encoding="utf-8")
    persona_path = tmp_path / "persona.json"
    persona_path.write_text(
        json.dumps(
            {
                "routing": {},
                "runtime_boundaries": [],
                "evidence_index": {"excerpts": "corpus/excerpts.jsonl"},
                "core_models": [{"model_id": "m1", "evidence_excerpt_ids": ["ex_missing"]}],
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(RuntimeLoadError, match="missing excerpts"):
        load_persona_json(persona_path)


def test_all_community_agent_skill_runtimes_pass_weak_validation() -> None:
    registry = load_registry([Path("examples/community-persona-registry.json")], root=ROOT)
    for agent in registry.agents.values():
        runtime = load_runtime_uncached(ROOT, agent)
        assert runtime.kind == "local_agent_skill"
        assert runtime.name
        assert runtime.description
        assert runtime.source or agent.source
