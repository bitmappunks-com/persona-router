#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Check imported community persona sources for upstream changes.")
    parser.add_argument("--sources", default="community-personas/SOURCES.jsonl")
    args = parser.parse_args()

    sources_path = Path(args.sources)
    failures: list[str] = []
    changed: list[dict[str, str]] = []
    for row in read_jsonl(sources_path):
        repository = row["repository"]
        current = row["source_commit"]
        try:
            upstream = ls_remote_head(repository)
        except subprocess.CalledProcessError as exc:
            failures.append(f"{repository}: {exc}")
            continue
        if upstream != current:
            changed.append(
                {
                    "repository": repository,
                    "imported_commit": current,
                    "upstream_commit": upstream,
                    "summary": f"{repository} changed from {current[:12]} to {upstream[:12]}",
                }
            )

    for item in changed:
        print(json.dumps(item, ensure_ascii=False))
    for failure in failures:
        print(f"ERROR {failure}", file=sys.stderr)
    if not changed and not failures:
        print("PASS community sources are up to date")
    return 1 if failures else 0


def read_jsonl(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError as exc:
            raise SystemExit(f"{path}:{line_no}: invalid JSONL: {exc}") from exc
    return rows


def ls_remote_head(repository: str) -> str:
    output = subprocess.check_output(
        ["git", "ls-remote", f"https://github.com/{repository}", "HEAD"],
        text=True,
    )
    return output.split()[0]


if __name__ == "__main__":
    raise SystemExit(main())
