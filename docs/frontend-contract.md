# Frontend Contract

This contract describes the data shapes a UI can use to build the first Persona Router product surface.

## Agent List

Source: `GET /agents`

Fields used by UI:

- `agent_id`
- `handle`
- `display_name`
- `enabled`
- `aliases`
- `source`
- `risk_level`
- `domains`
- `dialogue.role`
- `dialogue.stance`
- `runtime_boundaries`

Recommended UI:

- Show each agent as a selectable row.
- Use `@handle` as the primary identifier.
- Show source and risk badges.
- Disable agents with `enabled = false`.

## Active Chips

Source: session `active_agent_ids`.

Recommended UI:

- Render active agents as removable chips.
- Removing a chip calls `POST /sessions/{id}/active` with the remaining handles.
- Mentioned agents in a new topic should visually replace or add based on `mention_activation_mode`.

## Input Box

Supported interaction patterns:

- `@feynman @steve_jobs <topic>`
- `active @feynman @steve_jobs`
- `deactivate @steve_jobs`
- `再讨论一轮`

Recommended UI:

- Provide `@` autocomplete from `GET /agents`.
- Keep a visible “next round” button that calls `POST /sessions/{id}/next`.
- Keep explicit active controls visible so users can see who will speak next.

## Round Transcript

Source: `POST /sessions/{id}/round` and `POST /sessions/{id}/next`.

Fields used by UI:

- `round.turns[].agent_id`
- `round.turns[].handle`
- `round.turns[].trigger`
- `round.turns[].content`
- `round.turns[].metadata.source`
- `round.turns[].metadata.boundary`

Recommended UI:

- Group turns by round.
- Show one block per agent.
- Display trigger: `mentioned`, `active`, or `moderator`.
- Display boundary flags when `needs_verification` or `boundary_downgraded` is true.

## Source Inspector

Sources:

- agent `source`
- turn `metadata.source`
- package `SOURCE.md`

Recommended UI:

- Link to upstream repository when available.
- Show imported commit.
- Show license status from `agent.source.license_status` or `turn.metadata.source.license_status`.
- Show warning text for third-party community Agent Skills.
