#!/usr/bin/env python3
"""
Check whether a generated persona SKILL.md passes baseline runtime quality gates.

This checker treats SKILL.md as the runtime entrypoint, not the whole persona.
It also inspects the adjacent persona package so a prompt-only draft cannot pass
as a research-backed persona.

Usage:
    python3 quality_check.py <SKILL.md>
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def section_text(content: str, header_pattern: str) -> str | None:
    header_re = re.compile(rf"^##\s+.*(?:{header_pattern}).*$", re.IGNORECASE | re.MULTILINE)
    match = header_re.search(content)
    if not match:
        return None
    next_header = re.search(r"^##\s+", content[match.end() :], re.MULTILINE)
    end = match.end() + next_header.start() if next_header else len(content)
    return content[match.end() : end]


def check_mental_models(content: str) -> tuple[bool, str]:
    section = section_text(content, r"心智模型|Mental Models?")
    if not section:
        return False, "No mental model section detected"

    subheads = re.findall(r"^###\s+", section, re.MULTILINE)
    numbered = re.findall(r"^\s*\d+\.\s+\*\*.+?\*\*", section, re.MULTILINE)
    count = len(subheads) or len(numbered)
    if count == 0:
        return False, "Mental model section has no model entries"
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
    source_text = section_text(content, r"来源|Source|Reference")
    if not source_text:
        return False, "No source/reference section found"

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


def load_json(path: Path) -> tuple[object | None, str | None]:
    try:
        return json.loads(path.read_text(encoding="utf-8")), None
    except FileNotFoundError:
        return None, f"Missing {path.name}"
    except json.JSONDecodeError as exc:
        return None, f"Invalid JSON in {path.name}: {exc}"


def iter_jsonl(path: Path) -> tuple[list[dict], str | None]:
    rows: list[dict] = []
    try:
        for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if not line.strip():
                continue
            try:
                item = json.loads(line)
            except json.JSONDecodeError as exc:
                return rows, f"Invalid JSONL in {path.name}:{line_no}: {exc}"
            if isinstance(item, dict):
                rows.append(item)
    except FileNotFoundError:
        return rows, f"Missing {path}"
    return rows, None


def check_package_files(skill_path: Path) -> tuple[bool, str]:
    root = skill_path.parent
    required = [
        "persona.json",
        "cases.jsonl",
        "evals.md",
    ]
    missing = [item for item in required if not (root / item).exists()]
    if missing:
        return False, "Missing lightweight runtime files: " + ", ".join(missing)

    optional_audit = [
        "corpus/sources.jsonl",
        "corpus/excerpts.jsonl",
        "evidence/mental-models.jsonl",
        "evidence/heuristics.jsonl",
        "evidence/expression-dna.json",
        "evidence/limits.md",
        "research",
        "tests",
    ]
    present = [item for item in optional_audit if (root / item).exists()]
    return True, f"Lightweight runtime files present; {len(present)}/{len(optional_audit)} audit assets present"


def check_persona_json(skill_path: Path) -> tuple[bool, str]:
    root = skill_path.parent
    data, error = load_json(root / "persona.json")
    if error:
        return False, error
    if not isinstance(data, dict):
        return False, "persona.json root must be an object"

    models = data.get("core_models")
    heuristics = data.get("heuristics")
    routing = data.get("routing")
    boundaries = data.get("runtime_boundaries")
    if not isinstance(models, list) or not isinstance(heuristics, list):
        return False, "persona.json must contain core_models and heuristics arrays"
    if not isinstance(routing, dict) or not routing:
        return False, "persona.json must contain a non-empty routing object"
    if not isinstance(boundaries, list) or not boundaries:
        return False, "persona.json must contain runtime_boundaries"

    problems: list[str] = []
    if not 3 <= len(models) <= 7:
        problems.append(f"{len(models)} core_models (expected 3-7)")
    if not 5 <= len(heuristics) <= 12:
        problems.append(f"{len(heuristics)} heuristics (expected 5-12)")

    for index, model in enumerate(models, start=1):
        if not isinstance(model, dict):
            problems.append(f"core_models[{index}] is not an object")
            continue
        for field in ("model_id", "applicable_contexts", "evidence_excerpt_ids", "confidence", "failure_modes"):
            if field not in model:
                problems.append(f"{model.get('model_id', f'core_models[{index}]')} missing {field}")

    if problems:
        return False, "; ".join(problems[:5])
    return True, f"persona.json runtime schema present ({len(models)} models, {len(heuristics)} heuristics)"


def check_evidence_backlinks(skill_path: Path) -> tuple[bool, str]:
    root = skill_path.parent
    excerpts_path = root / "corpus" / "excerpts.jsonl"
    if not excerpts_path.exists():
        return True, "No excerpts.jsonl; skipped for lightweight-only package"

    data, error = load_json(root / "persona.json")
    if error or not isinstance(data, dict):
        return False, error or "persona.json root must be an object"

    excerpts, error = iter_jsonl(excerpts_path)
    if error:
        return False, error
    excerpt_ids = {row.get("excerpt_id") for row in excerpts}

    refs: set[str] = set()
    for collection_name in ("core_models", "heuristics"):
        collection = data.get(collection_name, [])
        if not isinstance(collection, list):
            continue
        for item in collection:
            if not isinstance(item, dict):
                continue
            for field in ("evidence_excerpt_ids", "counterevidence_excerpt_ids"):
                values = item.get(field, [])
                if isinstance(values, list):
                    refs.update(value for value in values if isinstance(value, str))

    missing = sorted(ref for ref in refs if ref not in excerpt_ids)
    if missing:
        return False, f"{len(missing)} persona evidence refs missing from excerpts.jsonl"
    return True, f"{len(refs)} persona evidence refs resolve to excerpts.jsonl"


def check_source_ledger(skill_path: Path) -> tuple[bool, str]:
    root = skill_path.parent
    sources_path = root / "corpus" / "sources.jsonl"
    if not sources_path.exists():
        return True, "No sources.jsonl; skipped for lightweight-only package"

    sources, error = iter_jsonl(sources_path)
    if error:
        return False, error

    usable = [
        row for row in sources
        if row.get("admission_status") in {"accepted", "limited"}
        and row.get("payload_status") in {"valid", "partial"}
    ]
    with_raw = [row for row in usable if row.get("raw_path")]
    independent = {row.get("source_cluster_id") for row in usable if row.get("counts_as_independent_source")}
    primary = [row for row in usable if row.get("source_tier") in {"P0", "P1", "P2"}]

    if len(with_raw) != len(usable):
        return False, f"{len(usable) - len(with_raw)} usable sources lack raw_path"
    if not usable:
        return False, "No accepted/limited sources with valid/partial payload"
    primary_ratio = len(primary) / len(usable)
    if primary_ratio < 0.5:
        return False, f"Primary source ratio {primary_ratio:.0%} below 50%"
    return True, f"{len(usable)} usable sources, {len(independent)} independent clusters, {primary_ratio:.0%} primary"


def check_case_cards(skill_path: Path) -> tuple[bool, str]:
    root = skill_path.parent
    cases, error = iter_jsonl(root / "cases.jsonl")
    if error:
        return False, error
    if not 20 <= len(cases) <= 40:
        return False, f"{len(cases)} case cards (expected 20-40)"

    required = ("case_id", "tags", "linked_models", "lesson", "use_when")
    problems: list[str] = []
    for case in cases:
        missing = [field for field in required if field not in case]
        if missing:
            problems.append(f"{case.get('case_id', '<unknown>')} missing {','.join(missing)}")
        if not isinstance(case.get("tags"), list) or not case.get("tags"):
            problems.append(f"{case.get('case_id', '<unknown>')} has no tags")
        if not isinstance(case.get("linked_models"), list) or not case.get("linked_models"):
            problems.append(f"{case.get('case_id', '<unknown>')} has no linked_models")
    if problems:
        return False, "; ".join(problems[:5])
    return True, f"{len(cases)} lightweight case cards present"


def check_evals(skill_path: Path) -> tuple[bool, str]:
    root = skill_path.parent
    evals_path = root / "evals.md"
    if not evals_path.exists():
        return False, "Missing evals.md"
    content = evals_path.read_text(encoding="utf-8")
    prompts = re.findall(r"^\d+\.\s+", content, re.MULTILINE)
    passed = len(prompts) >= 20
    return passed, f"{len(prompts)} eval prompts {'PASS' if passed else 'FAIL (expected >=20)'}"


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python3 quality_check.py <SKILL.md>")
        return 1

    skill_path = Path(sys.argv[1])
    if not skill_path.exists():
        print(f"File does not exist: {skill_path}")
        return 1

    content = skill_path.read_text(encoding="utf-8")
    content_checks = [
        ("Mental models", lambda: check_mental_models(content)),
        ("Model limitations", lambda: check_limitations(content)),
        ("Expression DNA", lambda: check_expression_dna(content)),
        ("Honest boundary", lambda: check_honest_boundary(content)),
        ("Internal tensions", lambda: check_tensions(content)),
        ("Primary sources", lambda: check_primary_sources(content)),
        ("Agentic protocol", lambda: check_agentic_protocol(content)),
        ("Package files", lambda: check_package_files(skill_path)),
        ("Persona JSON", lambda: check_persona_json(skill_path)),
        ("Evidence backlinks", lambda: check_evidence_backlinks(skill_path)),
        ("Source ledger", lambda: check_source_ledger(skill_path)),
        ("Case cards", lambda: check_case_cards(skill_path)),
        ("Evals", lambda: check_evals(skill_path)),
    ]

    print(f"Quality check: {skill_path}")
    print("=" * 72)
    passed_count = 0
    for name, check_fn in content_checks:
        passed, detail = check_fn()
        status = "PASS" if passed else "FAIL"
        print(f"{name:<20} {status:<5} {detail}")
        if passed:
            passed_count += 1

    print("=" * 72)
    print(f"Result: {passed_count}/{len(content_checks)} passed")
    return 0 if passed_count == len(content_checks) else 1


if __name__ == "__main__":
    raise SystemExit(main())
