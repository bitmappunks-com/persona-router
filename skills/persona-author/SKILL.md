---
name: persona-author
description: Author a runtime persona package for the persona-router. Use when the user wants to add a new local persona under local-personas/, distill a real person/role/topic into an evidence-backed Agent Skill, or upgrade a prompt-only draft into a research-backed package. Trigger phrases include "create a persona", "new local skill", "造一个 persona", "写一个 SKILL", "把 X 蒸馏成 skill". Not for: tweaking an existing persona's wording (do that in the file directly); editing community-personas (those are imported, not authored here).
---

# persona-author

A local persona package is an auditable runtime artifact, not a prompt. This skill walks you through producing one that the persona-router can load alongside `local-personas/warren-buffett-perspective/` and `community-personas/*`.

## When to use

- The user asks to add a new voice to the router that doesn't exist in `community-personas/` and isn't already in `local-personas/`.
- The user wants to upgrade a sketch (just a system prompt) into a research-backed package with sources, evidence, and behavioural boundaries.
- The user wants to audit whether an existing local persona meets the production bar.

Don't trigger when:
- The user is editing an existing persona's wording. Edit the file directly.
- The user is importing a third-party skill. That goes through `scripts/import_community_personas.py` into `community-personas/`, not here.

## Output layout

Land in `local-personas/<persona-name>/` mirroring the warren-buffett package:

```
local-personas/<persona-name>/
├── SKILL.md                 # runtime entrypoint with frontmatter (name, description)
├── persona.json             # machine-readable routing + core_models + boundaries
├── SOURCE.md                # upstream / license / commit / imported-on
├── corpus/
│   ├── sources.jsonl        # only sources with raw_path + payload validation
│   ├── excerpts.jsonl       # quotes extracted from corpus/raw
│   ├── excerpt-audit.md
│   └── coverage-matrix.md
├── research/                # evidence-chain notes (one file per angle)
├── evidence/                # heuristics.jsonl, mental-models.jsonl, contradictions.md
├── tests/                   # voice-tests, known-stance-tests, regression-prompts
├── cases.jsonl              # case cards (optional)
└── evals.md                 # quality report
```

Generated artifacts that must stay out of git: `corpus/raw/`, `discovery/`, `corpus/iteration-*`, `corpus/excerpts.draft-*`, `research/iteration-*`. The repo `.gitignore` already covers them under `**/` patterns.

## Non-negotiables

1. **Archive before analysis.** Anything supporting an `accepted` source must have a `raw_path` pointing to `corpus/raw/`. Search snippets, AI summaries, and one-off browser reads are not evidence.
2. **Payload before file existence.** A PDF that's a redirect shell, an index page, or a player skeleton does not count as `valid`. Confirm extractable text/transcript/data.
3. **Independent sources, not duplicates.** Track both `raw_item_count` and `independent_source_count`. A 30-episode podcast series isn't 30 sources.
4. **Generation order is strict.** discover → filter → archive → sources.jsonl → excerpts.jsonl → research → evidence → SKILL.md + persona.json → tests. Don't skip steps, don't write SKILL.md from impressions.
5. **Iterate until coverage is honest.** One discovery-acquisition loop is rarely enough. Diagnose gaps, design the next iteration, repeat.

## Workflow

1. **Discover candidates** (Step 1): scan canonical sources, list everything plausible into `discovery/candidate-sources.jsonl`. No downloads yet.
2. **Filter + canonicalise** (Step 2): drop spam, dedupe, trace to original publication, write the admission queue.
3. **Archive raw** (Step 3): download/export into `corpus/raw/<bucket>/`. Validate each payload — open the file, confirm content extracts.
4. **Source ledger** (Step 4): only `valid` raw entries land in `corpus/sources.jsonl` with `raw_path`, `license_status`, `independent_source_id`.
5. **Excerpts** (Step 5): pull quotable passages into `corpus/excerpts.jsonl` with `excerpt_id`, `source_id`, `raw_path`, `verbatim`.
6. **Research** (Step 6): per-angle markdown in `research/` showing evidence chain, counterevidence, gaps. No bullet-list summaries without citations.
7. **Distill** (Step 7): write `evidence/mental-models.jsonl`, `heuristics.jsonl`, `contradictions.md`, then `persona.json`, then `SKILL.md`.
8. **Validate** (Step 8): run `python3 scripts/quality_check.py local-personas/<persona>/SKILL.md`, then write `tests/` and `evals.md`.

## Reference

The full spec — with field schemas, payload validation rules, diagnostic templates, and the discovery-acquisition iteration loop — lives in [`reference/spec.md`](reference/spec.md). Read it whenever a question can't be resolved by analogy with `local-personas/warren-buffett-perspective/`.
