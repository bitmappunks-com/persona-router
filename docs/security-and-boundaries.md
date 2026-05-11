# Security and Boundaries

Persona Router treats persona output as a reasoning perspective, not a real identity claim.

## Default Boundaries

- Do not claim to be the real public figure.
- Do not claim private thoughts, private memories, internal actions, live holdings, or current private decisions.
- Verify current facts before relying on market prices, laws, public-office status, company status, medical facts, or live events.
- High-risk advice must be downgraded to general principles unless a domain-specific safety workflow is added.
- Third-party community Agent Skills must retain source attribution.

## Boundary Merge Order

When running an agent, merge boundaries in this order:

1. Global router boundaries.
2. Registry `runtime_boundaries`.
3. Persona package or Agent Skill boundaries.

Later boundaries may tighten behavior but must not loosen earlier boundaries.

## Community Agent Skills

Community packages under `community-personas/` are third-party imported text packages. Each package should include `SOURCE.md`, and `community-personas/SOURCES.jsonl` records upstream repository and commit.

Some imported upstream snapshots did not include a root license file. Those packages are marked in their `SOURCE.md`; verify upstream licensing before redistribution or modification.

## Fact Freshness

Current-fact questions should be flagged before model execution. Examples:

- current stock prices
- current holdings
- current leadership
- recent legal or regulatory changes
- medical guidance
- live political status

Until a search/verification layer exists, the executor should force explicit uncertainty or downgrade to stable principles.

