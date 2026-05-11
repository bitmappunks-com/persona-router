from __future__ import annotations

import subprocess
import sys
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_community_persona_audit_script() -> None:
    result = subprocess.run(
        [sys.executable, "persona_router/scripts/audit_community_personas.py", "."],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert "PASS community persona audit" in result.stdout


def test_community_sources_include_license_status() -> None:
    rows = [
        json.loads(line)
        for line in (ROOT / "community-personas" / "SOURCES.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    assert {row["license_status"] for row in rows} <= {"license_present", "license_missing", "license_unknown"}
    assert any(row["license_status"] == "license_missing" for row in rows)
