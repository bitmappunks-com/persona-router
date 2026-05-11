#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
from pathlib import Path


INCLUDE_SUFFIXES = {".md", ".json", ".jsonl", ".txt", ".yaml", ".yml", ".py", ".sh"}
INCLUDE_NAMES = {"SKILL.md", "README", "README.md", "README.en.md", "LICENSE", "LICENSE.md", "CONTRIBUTING.md"}
EXCLUDE_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build"}
SKIPPED_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".mp4", ".mov", ".pdf", ".zip", ".tar", ".gz"}
GENERATED_FILES = {"tools/vector_index.json"}


def main() -> int:
    parser = argparse.ArgumentParser(description="Import community persona Agent Skill repositories.")
    parser.add_argument("--manifest", help="JSONL manifest with slug, repository, title, description")
    parser.add_argument("--awesome-readme", help="README.md from xixu-me/awesome-persona-distill-skills")
    parser.add_argument("--clone-root", required=True, help="Directory containing upstream repos cloned by slug")
    parser.add_argument("--clone-missing", action="store_true", help="Shallow clone repos that are not present in clone-root")
    parser.add_argument("--output-root", default="community-personas")
    parser.add_argument("--registry-output", default="registries/community.json")
    parser.add_argument("--sources-output", default="community-personas/SOURCES.jsonl")
    parser.add_argument("--imported-on", required=True)
    args = parser.parse_args()

    manifest = load_manifest(args.manifest, args.awesome_readme)
    clone_root = Path(args.clone_root)
    output_root = Path(args.output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    sources: list[dict] = []
    agents: list[dict] = []
    for item in manifest:
        source_dir = clone_root / item["slug"]
        if not source_dir.exists() and args.clone_missing:
            clone_repo(item["repository"], source_dir)
        if not (source_dir / "SKILL.md").exists():
            raise SystemExit(f"{item['slug']}: missing root SKILL.md")
        target_dir = output_root / item["slug"]
        if target_dir.exists():
            shutil.rmtree(target_dir)
        target_dir.mkdir(parents=True)

        copied, skipped_binary, skipped_generated = copy_text_package(source_dir, target_dir)
        commit = subprocess.check_output(["git", "-C", str(source_dir), "rev-parse", "HEAD"], text=True).strip()
        source_url = f"https://github.com/{item['repository']}"
        write_source_md(target_dir, source_url, commit, args.imported_on, skipped_generated)

        sources.append(
            {
                "slug": item["slug"],
                "title": item["title"],
                "repository": item["repository"],
                "source_url": source_url,
                "source_commit": commit,
                "category": item.get("category", "公众人物与方法论视角"),
                "format_check": "root_SKILL_md_present",
                "imported_path": str(target_dir),
                "imported_on": args.imported_on,
                "imported_files_count": copied,
                "excluded_binary_files_count": skipped_binary,
                "excluded_generated_files": skipped_generated,
                "license_status": license_status(target_dir),
            }
        )
        agents.append(build_agent(item, source_url, commit, args.imported_on, copied, skipped_binary, skipped_generated, license_status(target_dir)))

    Path(args.sources_output).write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in sources), encoding="utf-8")
    Path(args.registry_output).write_text(
        json.dumps(
            {
                "schema_version": "0.1.0",
                "default_mention_activation_mode": "replace_for_topic",
                "agents": agents,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"imported {len(sources)} community persona skills")
    return 0


def load_manifest(manifest_path: str | None, awesome_readme_path: str | None) -> list[dict]:
    if manifest_path:
        return [json.loads(line) for line in Path(manifest_path).read_text(encoding="utf-8").splitlines() if line.strip()]
    if awesome_readme_path:
        return parse_awesome_readme(Path(awesome_readme_path))
    raise SystemExit("Provide --manifest or --awesome-readme")


def parse_awesome_readme(path: Path) -> list[dict]:
    items: list[dict] = []
    category = "公众人物与方法论视角"
    seen: set[str] = set()
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        heading = re.match(r"^#{2,6}\s+(.+)$", line)
        if heading:
            category = heading.group(1).strip()
            continue
        for title, repository in re.findall(r"\[([^\]]+)\]\(https://github\.com/([^/)]+/[^/)]+)\)", line):
            if repository in seen:
                continue
            seen.add(repository)
            slug = normalize_repo_slug(repository)
            description = re.sub(r"\[[^\]]+\]\([^)]+\)", title, line).strip(" -*\t")
            items.append(
                {
                    "slug": slug,
                    "repository": repository,
                    "title": title.strip(),
                    "description": description or title.strip(),
                    "category": category,
                }
            )
    return items


def normalize_repo_slug(repository: str) -> str:
    return re.sub(r"[^a-z0-9._-]+", "-", repository.split("/", 1)[1].lower()).strip("-")


def clone_repo(repository: str, target_dir: Path) -> None:
    target_dir.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["git", "clone", "--depth", "1", f"https://github.com/{repository}", str(target_dir)],
        check=True,
    )


def copy_text_package(source_dir: Path, target_dir: Path) -> tuple[int, int, list[str]]:
    copied = 0
    skipped_binary = 0
    skipped_generated: list[str] = []
    for current, dirs, files in os.walk(source_dir):
        cur = Path(current)
        dirs[:] = [name for name in dirs if name not in EXCLUDE_DIRS]
        rel_dir = cur.relative_to(source_dir)
        for filename in files:
            source_file = cur / filename
            rel = rel_dir / filename
            rel_text = rel.as_posix()
            if rel_text in GENERATED_FILES:
                skipped_generated.append(rel_text)
                continue
            if filename in INCLUDE_NAMES or source_file.suffix.lower() in INCLUDE_SUFFIXES:
                target = target_dir / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source_file, target)
                copied += 1
            elif source_file.suffix.lower() in SKIPPED_SUFFIXES:
                skipped_binary += 1
    return copied, skipped_binary, skipped_generated


def write_source_md(target_dir: Path, source_url: str, commit: str, imported_on: str, skipped_generated: list[str]) -> None:
    generated = ""
    if skipped_generated:
        generated = ", and generated files: " + ", ".join(f"`{item}`" for item in skipped_generated)
    text = f"""# Source

This community persona Agent Skill was imported from the upstream repository below.

- Upstream repository: {source_url}
- Upstream commit: `{commit}`
- Upstream category: `公众人物与方法论视角` from `xixu-me/awesome-persona-distill-skills`
- Imported on: {imported_on}
- Imported scope: root Agent Skill text package (`SKILL.md`, README/License, references/examples text, scripts/config text where present)
- Excluded from import: git metadata, dependency directories, generated dependencies, and binary media assets{generated}

This package is third-party community content. Preserve source attribution and verify upstream licensing before redistribution.
"""
    (target_dir / "SOURCE.md").write_text(text, encoding="utf-8")


def build_agent(
    item: dict,
    source_url: str,
    commit: str,
    imported_on: str,
    copied: int,
    skipped_binary: int,
    skipped_generated: list[str],
    license_state: str,
) -> dict:
    slug = item["slug"]
    handle = normalize_slug(slug)
    agent_id = "community_" + handle
    enabled_policy = default_enabled_policy(item, license_state)
    risk_level = infer_risk_level(item)
    domains = infer_domains(item)
    return {
        "agent_id": agent_id,
        "handle": handle,
        "display_name": item["title"],
        "enabled": enabled_policy["enabled"],
        "risk_level": risk_level,
        "domains": domains,
        "persona_ref": {
            "type": "local_agent_skill",
            "path": f"community-personas/{slug}",
            "entrypoint": "SKILL.md",
        },
        "activation": {
            "default_active": False,
            "allow_manual_toggle": True,
            "aliases": [slug, item["title"]],
        },
        "dialogue": {
            "role": "participant",
            "stance": item["description"][:240],
            "turn_policy": "speak_when_active_or_mentioned",
            "max_words_per_turn": int(item.get("max_words_per_turn", 260)),
            "can_question_others": True,
        },
        "runtime_boundaries": [
            "Third-party imported community Agent Skill; verify source quality before relying on factual claims.",
            "Use persona voice only as a reasoning perspective, not as a real identity claim.",
            "Verify current facts before relying on recent events, market data, legal facts, medical facts, or live public-figure status.",
            "For political, medical, legal, financial, or safety-sensitive topics, provide only general non-authoritative analysis unless verified by reliable sources.",
        ],
        "metadata": {
            "source_repository": source_url,
            "source_commit": commit,
            "source_index": "https://github.com/xixu-me/awesome-persona-distill-skills",
            "source_category": "public_figures_and_methodology_perspectives",
            "imported_on": imported_on,
            "imported_files_count": copied,
            "excluded_binary_files_count": skipped_binary,
            "excluded_generated_files": skipped_generated,
            "license_status": license_state,
            "enabled_policy": enabled_policy["reason"],
        },
    }


def default_enabled_policy(item: dict, license_state: str) -> dict[str, object]:
    if "enabled" in item:
        return {"enabled": bool(item["enabled"]), "reason": "manifest_override"}
    if license_state == "license_missing":
        return {"enabled": False, "reason": "disabled_until_license_review"}
    return {"enabled": True, "reason": "enabled_with_source_and_license_metadata"}


def infer_risk_level(item: dict) -> str:
    text = " ".join(str(item.get(key, "")) for key in ("slug", "title", "description", "category")).lower()
    high_risk_terms = [
        "buffett",
        "munger",
        "trump",
        "mao",
        "karl",
        "marx",
        "mises",
        "stock",
        "投资",
        "政治",
        "法律",
        "医学",
    ]
    return "high" if any(term in text for term in high_risk_terms) else "medium"


def infer_domains(item: dict) -> list[str]:
    text = " ".join(str(item.get(key, "")) for key in ("slug", "title", "description", "category")).lower()
    domains: list[str] = ["methodology"]
    if any(term in text for term in ["buffett", "munger", "mises", "invest", "stock", "投资"]):
        domains.append("investing")
    if any(term in text for term in ["trump", "mao", "marx", "politic", "政治"]):
        domains.append("politics")
    if any(term in text for term in ["feynman", "ilya", "science", "科学"]):
        domains.append("science")
    if any(term in text for term in ["jobs", "yiming", "musk", "startup", "创业", "产品"]):
        domains.append("entrepreneurship")
    if any(term in text for term in ["guodegang", "bieber", "star", "文艺", "娱乐"]):
        domains.append("arts")
    return sorted(set(domains))


def normalize_slug(slug: str) -> str:
    handle = re.sub(r"[^a-z0-9]+", "_", slug.lower()).strip("_")
    return handle[:-6] if handle.endswith("_skill") else handle


def license_status(package_dir: Path) -> str:
    if any(child.is_file() and child.name.upper().startswith("LICENSE") for child in package_dir.iterdir()):
        return "license_present"
    return "license_missing"


if __name__ == "__main__":
    raise SystemExit(main())
