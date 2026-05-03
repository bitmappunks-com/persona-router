#!/usr/bin/env python3
"""
Check whether a generated persona SKILL.md passes baseline runtime quality gates.

This is a lightweight structural checker. It does not replace corpus/evidence
review, but it catches missing runtime sections before handoff.

Usage:
    python3 quality_check.py <SKILL.md>
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


def check_mental_models(content: str) -> tuple[bool, str]:
    models = re.findall(r"^###\s+(?:模型|Model|心智模型)\s*\d", content, re.MULTILINE)
    if not models:
        in_section = False
        count = 0
        for line in content.split("\n"):
            if re.match(r"^##\s+.*心智模型|Mental Model", line, re.IGNORECASE):
                in_section = True
                continue
            if in_section and re.match(r"^##\s+", line) and "心智模型" not in line:
                break
            if in_section and re.match(r"^###\s+", line):
                count += 1
        if count > 0:
            passed = 3 <= count <= 7
            return passed, f"{count} mental models {'PASS' if passed else 'FAIL (expected 3-7)'}"

    count = len(models)
    if count == 0:
        return False, "No mental model section detected"
    passed = 3 <= count <= 7
    return passed, f"{count} mental models {'PASS' if passed else 'FAIL (expected 3-7)'}"


def check_limitations(content: str) -> tuple[bool, str]:
    has_limitation = bool(re.search(r"局限|失效|不适用|盲区|limitation|blind spot|failure mode", content, re.IGNORECASE))
    return has_limitation, "Limitations present" if has_limitation else "No limitation/failure-mode text found"


def check_expression_dna(content: str) -> tuple[bool, str]:
    dna_section = bool(re.search(r"表达DNA|Expression DNA|表达风格", content, re.IGNORECASE))
    if not dna_section:
        return False, "No expression DNA section found"

    style_markers = len(re.findall(r"句式|词汇|语气|幽默|节奏|确定性|引用|口头禅|hedging|analogy|rhythm", content, re.IGNORECASE))
    passed = style_markers >= 3
    return passed, f"{style_markers} expression markers {'PASS' if passed else 'FAIL (expected >=3)'}"


def check_honest_boundary(content: str) -> tuple[bool, str]:
    boundary_match = re.search(
        r"(?:##\s+.*诚实边界|##\s+.*Honest Boundar(?:y|ies)|##\s+.*Limitations)(.*?)(?=\n##\s|\Z)",
        content,
        re.DOTALL | re.IGNORECASE,
    )
    if not boundary_match:
        return False, "No honest boundary / limitations section found"

    boundary_text = boundary_match.group(1)
    items = re.findall(r"^[-*]\s+|^\d+\.\s+", boundary_text, re.MULTILINE)
    count = len(items)
    passed = count >= 3
    return passed, f"{count} boundary items {'PASS' if passed else 'FAIL (expected >=3)'}"


def check_tensions(content: str) -> tuple[bool, str]:
    tension_markers = len(re.findall(r"张力|矛盾|tension|paradox|一方面.*另一方面|既.*又|contradiction", content, re.IGNORECASE))
    passed = tension_markers >= 2
    return passed, f"{tension_markers} tension markers {'PASS' if passed else 'FAIL (expected >=2)'}"


def check_primary_sources(content: str) -> tuple[bool, str]:
    source_section = re.search(r"(?:##\s+.*来源|##\s+.*Source|##\s+.*Reference)(.*?)(?=\n##\s|\Z)", content, re.DOTALL | re.IGNORECASE)
    if not source_section:
        return False, "No source/reference section found"

    source_text = source_section.group(1)
    primary = len(re.findall(r"一手|primary|本人著作|原始|official|self-authored", source_text, re.IGNORECASE))
    secondary = len(re.findall(r"二手|secondary|转述|评论|analysis|reported", source_text, re.IGNORECASE))
    total = primary + secondary
    if total == 0:
        return False, "Sources are not typed as primary/secondary"

    ratio = primary / total
    passed = ratio > 0.5
    return passed, f"Primary source markers: {primary}/{total} ({ratio:.0%}) {'PASS' if passed else 'FAIL (expected >50%)'}"


def check_agentic_protocol(content: str) -> tuple[bool, str]:
    has_protocol = bool(re.search(r"回答工作流|Agentic Protocol|研究协议|research protocol", content, re.IGNORECASE))
    has_search_rule = bool(re.search(r"先研究|先查|WebSearch|dokobot|事实|latest|current", content, re.IGNORECASE))
    passed = has_protocol and has_search_rule
    return passed, "Agentic protocol present" if passed else "Missing agentic research protocol"


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python3 quality_check.py <SKILL.md>")
        return 1

    skill_path = Path(sys.argv[1])
    if not skill_path.exists():
        print(f"File does not exist: {skill_path}")
        return 1

    content = skill_path.read_text(encoding="utf-8")
    checks = [
        ("Mental models", check_mental_models),
        ("Model limitations", check_limitations),
        ("Expression DNA", check_expression_dna),
        ("Honest boundary", check_honest_boundary),
        ("Internal tensions", check_tensions),
        ("Primary sources", check_primary_sources),
        ("Agentic protocol", check_agentic_protocol),
    ]

    print(f"Quality check: {skill_path}")
    print("=" * 72)
    passed_count = 0
    for name, check_fn in checks:
        passed, detail = check_fn(content)
        status = "PASS" if passed else "FAIL"
        print(f"{name:<20} {status:<5} {detail}")
        if passed:
            passed_count += 1

    print("=" * 72)
    print(f"Result: {passed_count}/{len(checks)} passed")
    return 0 if passed_count == len(checks) else 1


if __name__ == "__main__":
    raise SystemExit(main())
