from __future__ import annotations

from pathlib import Path

import pytest

from persona_router.registry import RegistryError, load_registry


ROOT = Path(__file__).resolve().parents[1]


def test_load_base_and_community_registries() -> None:
    registry = load_registry(
        [Path("registries/local.json"), Path("registries/community.json")],
        root=ROOT,
    )
    assert len(registry.agents) == 32
    assert registry.resolve_handle("@buffett").agent_id == "buffett"
    assert registry.resolve_handle("feynman").agent_id == "community_feynman"
    assert registry.resolve_handle("乔布斯.skill").agent_id == "community_steve_jobs"
    feynman = registry.resolve_handle("feynman").summary()
    assert feynman["source"]["source_repository"] == "https://github.com/alchaincyf/feynman-skill"
    assert feynman["source"]["license_status"] == "license_present"
    assert feynman["risk_level"] == "medium"


def test_agent_entrypoints_exist() -> None:
    registry = load_registry(
        [Path("registries/local.json"), Path("registries/community.json")],
        root=ROOT,
    )
    for agent in registry.agents.values():
        ref = agent.persona_ref
        if ref["type"] in {"local_persona_package", "local_agent_skill"}:
            assert (ROOT / ref["path"] / ref.get("entrypoint", "SKILL.md")).exists()


def test_unknown_handle_error_includes_suggestions() -> None:
    registry = load_registry(
        [Path("registries/local.json"), Path("registries/community.json")],
        root=ROOT,
    )
    with pytest.raises(RegistryError) as excinfo:
        registry.resolve_handle("@not_a_real_agent")
    assert "Available handles include:" in str(excinfo.value)

    with pytest.raises(RegistryError) as typo_excinfo:
        registry.resolve_handle("@feyman")
    assert "Did you mean: @feynman" in str(typo_excinfo.value)


def test_list_agents_filters() -> None:
    registry = load_registry(
        [Path("registries/local.json"), Path("registries/community.json")],
        root=ROOT,
    )
    community = registry.list_agents(source="public_figures_and_methodology_perspectives", enabled_only=False)
    assert len(community) == 31
    enabled_community = registry.list_agents(source="public_figures_and_methodology_perspectives")
    assert len(enabled_community) == 26
    medium = registry.list_agents(risk_level="medium", enabled_only=False)
    assert len(medium) == 24
    high = registry.list_agents(risk_level="high", enabled_only=False)
    assert len(high) == 8
