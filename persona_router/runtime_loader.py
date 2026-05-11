from __future__ import annotations

import re
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .registry import Agent


class RuntimeLoadError(ValueError):
    """Raised when a persona runtime cannot be loaded."""


@dataclass(frozen=True)
class RuntimePackage:
    kind: str
    path: Path | None
    entrypoint: str
    name: str
    description: str
    source: dict[str, Any]
    boundaries: list[str]
    skill_text_excerpt: str
    assets: dict[str, Any]


FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
_RUNTIME_CACHE: dict[tuple[str, str, int], RuntimePackage] = {}


def load_runtime(root: Path, agent: Agent) -> RuntimePackage:
    return load_runtime_cached(root, agent)


def load_runtime_uncached(root: Path, agent: Agent) -> RuntimePackage:
    ref = agent.persona_ref
    kind = ref["type"]
    if kind in {"local_persona_package", "local_agent_skill"}:
        base = root / ref["path"]
        entrypoint = ref.get("entrypoint", "SKILL.md")
        skill_path = base / entrypoint
        text = skill_path.read_text(encoding="utf-8", errors="replace")
        frontmatter = parse_frontmatter(text)
        source = load_source(base)
        if kind == "local_agent_skill":
            validate_agent_skill_runtime(agent, frontmatter, source)
        boundaries = list(agent.data.get("runtime_boundaries", []))
        assets: dict[str, Any] = {}
        if kind == "local_persona_package":
            persona_json_path = base / ref.get("persona_json", "persona.json")
            persona_data = load_persona_json(persona_json_path)
            assets["persona_json"] = persona_data
            cases_path = base / "cases.jsonl"
            if cases_path.exists():
                assets["case_count"] = count_jsonl(cases_path)
            evals_path = base / "evals.md"
            if evals_path.exists():
                assets["evals_path"] = str(evals_path)
        return RuntimePackage(
            kind=kind,
            path=base,
            entrypoint=entrypoint,
            name=frontmatter.get("name") or agent.display_name,
            description=frontmatter.get("description") or agent.dialogue.get("stance", ""),
            source=source,
            boundaries=boundaries,
            skill_text_excerpt=text[:1600],
            assets=assets,
        )
    if kind == "inline_prompt":
        return RuntimePackage(
            kind=kind,
            path=None,
            entrypoint="inline",
            name=agent.display_name,
            description=ref["prompt"][:500],
            source={},
            boundaries=list(agent.data.get("runtime_boundaries", [])),
            skill_text_excerpt=ref["prompt"][:1600],
            assets={},
        )
    raise RuntimeLoadError(f"Unsupported runtime kind for execution: {kind}")


def parse_frontmatter(text: str) -> dict[str, str]:
    match = FRONTMATTER_RE.match(text)
    if not match:
        return {}
    data: dict[str, str] = {}
    current_key: str | None = None
    for line in match.group(1).splitlines():
        if not line.strip():
            continue
        if re.match(r"^[A-Za-z_][A-Za-z0-9_-]*:", line):
            key, value = line.split(":", 1)
            key = key.strip()
            value = value.strip()
            if value == "|":
                data[key] = ""
                current_key = key
            else:
                data[key] = value.strip("\"'")
                current_key = None
        elif current_key:
            data[current_key] = (data[current_key] + "\n" + line.strip()).strip()
    return data


def load_source(base: Path) -> dict[str, Any]:
    source_path = base / "SOURCE.md"
    if not source_path.exists():
        return {}
    source: dict[str, Any] = {"path": str(source_path)}
    for line in source_path.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("- Upstream repository:"):
            source["upstream_repository"] = line.split(":", 1)[1].strip()
        elif line.startswith("- Upstream commit:"):
            source["upstream_commit"] = line.split(":", 1)[1].strip().strip("`")
        elif line.startswith("- Upstream category:"):
            source["upstream_category"] = line.split(":", 1)[1].strip()
        elif line.startswith("- Imported on:"):
            source["imported_on"] = line.split(":", 1)[1].strip()
    return source


def load_persona_json(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RuntimeLoadError(f"Missing persona.json: {path}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeLoadError(f"Invalid persona.json: {path}: {exc}") from exc
    for field in ("routing", "core_models", "runtime_boundaries"):
        if field not in data:
            raise RuntimeLoadError(f"persona.json missing {field}: {path}")
    if not isinstance(data["core_models"], list) or not data["core_models"]:
        raise RuntimeLoadError(f"persona.json has no core_models: {path}")
    validate_optional_evidence_refs(path.parent, data, path)
    return data


def validate_optional_evidence_refs(base: Path, data: dict[str, Any], persona_path: Path) -> None:
    refs = collect_evidence_refs(data)
    if not refs:
        return
    excerpts_ref = data.get("evidence_index", {}).get("excerpts", "corpus/excerpts.jsonl")
    excerpts_path = base / excerpts_ref
    if not excerpts_path.exists():
        return
    known_ids = load_excerpt_ids(excerpts_path)
    missing = sorted(ref for ref in refs if ref not in known_ids)
    if missing:
        preview = ", ".join(missing[:8])
        raise RuntimeLoadError(f"persona.json references missing excerpts in {persona_path}: {preview}")


def collect_evidence_refs(value: Any) -> set[str]:
    refs: set[str] = set()
    if isinstance(value, dict):
        for key, item in value.items():
            if key in {"evidence_excerpt_ids", "counterevidence_excerpt_ids"} and isinstance(item, list):
                refs.update(str(ref) for ref in item)
            else:
                refs.update(collect_evidence_refs(item))
    elif isinstance(value, list):
        for item in value:
            refs.update(collect_evidence_refs(item))
    return refs


def load_excerpt_ids(path: Path) -> set[str]:
    ids: set[str] = set()
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            item = json.loads(line)
        except json.JSONDecodeError as exc:
            raise RuntimeLoadError(f"Invalid excerpts JSONL in {path}:{line_no}: {exc}") from exc
        excerpt_id = item.get("excerpt_id")
        if excerpt_id:
            ids.add(str(excerpt_id))
    return ids


def count_jsonl(path: Path) -> int:
    count = 0
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            json.loads(line)
        except json.JSONDecodeError as exc:
            raise RuntimeLoadError(f"Invalid JSONL in {path}:{line_no}: {exc}") from exc
        count += 1
    return count


def load_runtime_cached(root: Path, agent: Agent) -> RuntimePackage:
    ref = agent.persona_ref
    if ref["type"] not in {"local_persona_package", "local_agent_skill"}:
        return load_runtime_uncached(root, agent)
    base = root / ref["path"]
    entrypoint = base / ref.get("entrypoint", "SKILL.md")
    source = base / "SOURCE.md"
    source_mtime = source.stat().st_mtime_ns if source.exists() else 0
    persona_json = base / ref.get("persona_json", "persona.json")
    persona_mtime = persona_json.stat().st_mtime_ns if persona_json.exists() else 0
    excerpts = base / "corpus" / "excerpts.jsonl"
    excerpts_mtime = excerpts.stat().st_mtime_ns if excerpts.exists() else 0
    key = (agent.agent_id, str(entrypoint.resolve()), entrypoint.stat().st_mtime_ns + source_mtime + persona_mtime + excerpts_mtime)
    if key not in _RUNTIME_CACHE:
        _RUNTIME_CACHE[key] = load_runtime_uncached(root, agent)
    return _RUNTIME_CACHE[key]


def validate_agent_skill_runtime(agent: Agent, frontmatter: dict[str, str], source: dict[str, Any]) -> None:
    if not frontmatter.get("name"):
        raise RuntimeLoadError(f"{agent.agent_id} SKILL.md frontmatter missing name")
    if not frontmatter.get("description"):
        raise RuntimeLoadError(f"{agent.agent_id} SKILL.md frontmatter missing description")
    if not source and not agent.source:
        raise RuntimeLoadError(f"{agent.agent_id} missing SOURCE.md or registry source metadata")
