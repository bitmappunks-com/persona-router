# Release Checklist

Use this checklist before tagging or publishing a Persona Router release.

## Schema

- Confirm whether schema changes require a `schema_version` bump.
- Validate all example registries and sessions.
- Validate `turn-plan.schema.json` and `round-result.schema.json` through tests.

## Migration Notes

- Summarize new fields and backward compatibility.
- Document any required registry migrations.
- Document any community persona import changes.

## Community Source Audit

- Run `make validate`.
- Confirm `community-personas/SOURCES.jsonl` has one row per imported package.
- Confirm each community package has `SKILL.md`.
- Confirm each community package has `SOURCE.md`.
- Confirm no binary assets, dependency directories, or oversized generated files are present.

## Runtime

- Run `make test`.
- Exercise CLI `validate`, `list-agents`, `session new`, `round`, and `next`.
- If real LLM execution is enabled, verify high-risk and current-fact downgrade behavior.

