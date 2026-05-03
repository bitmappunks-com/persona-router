#!/usr/bin/env python3
"""
Merge persona research files into a Phase 1.5 review checkpoint.

Scans research/*.md or references/research/*.md under a persona directory and
prints a Markdown summary table with source counts, primary/secondary markers,
key findings, contradictions, and missing dimensions.

Usage:
    python3 merge_research.py <persona_dir>
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


RESEARCH_FILES = {
    "01-systematic-writings": "系统表达",
    "02-long-conversations": "长对话",
    "03-short-expression": "短表达",
    "04-decisions-actions": "决策行动",
    "05-failures-controversies": "失败争议",
    "06-external-views": "外部视角",
    "07-timeline-evolution": "时间线",
    "08-domain-context": "领域背景",
    "09-interaction-patterns": "互动模式",
}

LEGACY_FILES = {
    "01-writings": "著作",
    "02-conversations": "对话",
    "03-expression-dna": "表达",
    "04-external-views": "他者",
    "05-decisions": "决策",
    "06-timeline": "时间线",
}


def count_sources(content: str) -> dict[str, int]:
    urls = re.findall(r"https?://[^\s\)]+", content)
    primary_markers = len(re.findall(r"一手|primary|本人|原文|原始|直接引用", content, re.IGNORECASE))
    secondary_markers = len(re.findall(r"二手|secondary|转述|总结|评论|分析", content, re.IGNORECASE))
    rejected_markers = len(re.findall(r"rejected|discovery_only|垃圾|污染|拒绝|降权", content, re.IGNORECASE))

    return {
        "url_count": len(urls),
        "unique_urls": len(set(urls)),
        "primary_markers": primary_markers,
        "secondary_markers": secondary_markers,
        "rejected_markers": rejected_markers,
    }


def extract_key_findings(content: str, max_items: int = 3) -> list[str]:
    headings = re.findall(r"^##\s+(.+)$", content, re.MULTILINE)
    if headings:
        return headings[:max_items]

    bolds = re.findall(r"\*\*(.+?)\*\*", content)
    if bolds:
        return bolds[:max_items]

    lines = [line.strip() for line in content.split("\n") if line.strip() and not line.startswith("#")]
    return [line[:50] + "..." if len(line) > 50 else line for line in lines[:max_items]]


def find_contradictions(files: dict[str, str], labels: dict[str, str]) -> list[str]:
    contradictions: list[str] = []
    for name, content in files.items():
        matches = re.findall(r"(?:矛盾|相反|但实际上|然而.*?不同|争议|反例|counterevidence).{0,100}", content)
        for match in matches:
            contradictions.append(f"{labels.get(name, name)}: {match[:80]}")
    return contradictions[:5]


def choose_research_dir(persona_dir: Path) -> Path:
    candidates = [
        persona_dir / "research",
        persona_dir / "references" / "research",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def summarize(research_dir: Path, file_map: dict[str, str]) -> tuple[list[str], dict[str, str], list[str], dict[str, int]]:
    rows: list[str] = []
    files: dict[str, str] = {}
    missing: list[str] = []
    totals = {
        "sources": 0,
        "primary": 0,
        "secondary": 0,
        "rejected": 0,
    }

    for key, label in file_map.items():
        md_file = research_dir / f"{key}.md"
        if not md_file.exists():
            missing.append(label)
            rows.append(f"| {label} | missing | - |")
            continue

        content = md_file.read_text(encoding="utf-8")
        files[key] = content
        stats = count_sources(content)
        findings = extract_key_findings(content)

        totals["sources"] += stats["unique_urls"]
        totals["primary"] += stats["primary_markers"]
        totals["secondary"] += stats["secondary_markers"]
        totals["rejected"] += stats["rejected_markers"]

        findings_text = ", ".join(findings) if findings else "-"
        rows.append(f"| {label} | {stats['unique_urls']} | {findings_text} |")

    return rows, files, missing, totals


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python3 merge_research.py <persona_dir>")
        return 1

    persona_dir = Path(sys.argv[1])
    research_dir = choose_research_dir(persona_dir)

    if not research_dir.exists():
        print(f"Research directory does not exist: {research_dir}")
        return 1

    file_map = RESEARCH_FILES
    if not any((research_dir / f"{key}.md").exists() for key in file_map):
        file_map = LEGACY_FILES

    rows, files, missing, totals = summarize(research_dir, file_map)
    contradictions = find_contradictions(files, file_map)
    denominator = totals["primary"] + totals["secondary"]
    primary_ratio = f"{totals['primary']}/{denominator}" if denominator else "unmarked"

    print("| Dimension | Sources | Key findings |")
    print("|---|---:|---|")
    for row in rows:
        print(row)
    print(f"| Total | {totals['sources']} | primary markers: {primary_ratio}; rejected markers: {totals['rejected']} |")
    print(f"| Contradictions | {len(contradictions)} | {contradictions[0] if contradictions else '-'} |")
    print(f"| Missing dimensions | {len(missing)} | {', '.join(missing) if missing else '-'} |")

    if totals["sources"] < 10:
        print("\nWarning: total source count is below 10. Mark the persona as draft or add research.")
    if missing:
        print(f"\nWarning: missing dimensions: {', '.join(missing)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
