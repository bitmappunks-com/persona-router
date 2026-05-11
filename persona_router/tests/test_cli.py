from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def run_cli(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "persona_router.cli", "--root", str(ROOT), "--json", *args],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


def test_cli_validate_and_list_agents() -> None:
    validate = run_cli("validate")
    assert validate.returncode == 0, validate.stderr
    assert json.loads(validate.stdout)["agents"] == 32

    listing = run_cli("list-agents")
    assert listing.returncode == 0, listing.stderr
    agents = json.loads(listing.stdout)
    assert any(agent["handle"] == "feynman" for agent in agents)

    filtered = run_cli("list-agents", "--source", "public_figures_and_methodology_perspectives")
    assert filtered.returncode == 0, filtered.stderr
    assert len(json.loads(filtered.stdout)) == 26
