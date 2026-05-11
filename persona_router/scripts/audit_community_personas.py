#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path


BINARY_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".mp4", ".mov", ".pdf", ".zip", ".tar", ".gz"}
GENERATED_NAMES = {"node_modules", ".git", "__pycache__"}
MAX_FILE_BYTES = 10 * 1024 * 1024


def main() -> int:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
    community = root / "community-personas"
    sources_path = community / "SOURCES.jsonl"
    problems: list[str] = []

    if not community.exists():
        problems.append("Missing community-personas directory")
    if not sources_path.exists():
        problems.append("Missing community-personas/SOURCES.jsonl")

    source_rows = []
    if sources_path.exists():
        for line_no, line in enumerate(sources_path.read_text(encoding="utf-8").splitlines(), start=1):
            try:
                source_rows.append(json.loads(line))
            except json.JSONDecodeError as exc:
                problems.append(f"Invalid SOURCES.jsonl line {line_no}: {exc}")

    for row in source_rows:
        slug = row.get("slug")
        package = community / str(slug)
        if not package.exists():
            problems.append(f"{slug}: missing package directory")
            continue
        if not (package / "SKILL.md").exists():
            problems.append(f"{slug}: missing SKILL.md")
        if not (package / "SOURCE.md").exists():
            problems.append(f"{slug}: missing SOURCE.md")

    for path in community.rglob("*"):
        parts = set(path.parts)
        blocked = parts & GENERATED_NAMES
        if blocked:
            problems.append(f"generated directory present: {path}")
        if path.is_file():
            if path.suffix.lower() in BINARY_SUFFIXES:
                problems.append(f"binary asset present: {path}")
            size = path.stat().st_size
            if size > MAX_FILE_BYTES:
                problems.append(f"oversized file {size} bytes: {path}")

    if problems:
        for problem in problems:
            print(f"FAIL {problem}", file=sys.stderr)
        return 1
    print(f"PASS community persona audit ({len(source_rows)} sources)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

