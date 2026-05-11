# Architecture

Persona Router has a deliberately small core. The router does not own persona content; it owns addressability, active state, turn ordering, and runtime loading.

## Components

### Registry Loader

`persona_router.registry` loads one or more registry files, validates them against `persona_router/schemas/persona-agent.schema.json`, resolves handles and aliases, and checks local runtime entrypoints.

Default registry order:

1. `registries/local.json`
2. `registries/community.json`
3. `agents.local.json`, if present

### Command Parser

`persona_router.commands` parses user input into intent, mentioned handles, topic, and round instruction.

Supported intents:

- `set_active`
- `activate`
- `deactivate`
- `topic_with_mentions`
- `topic`
- `next_round`
- `list_agents`

### Session Manager

`persona_router.session` stores per-conversation state:

- available agents
- active agents
- mention activation mode
- topic
- round index
- turns

Active state is session-local and must not be written back to registry files.

### Turn Planner

`persona_router.planner` builds deterministic turn plans:

1. user mention order
2. active agent order
3. moderators/summarizers after participants

It respects `turn_policy` values from the agent registry.

### Runtime Loader

`persona_router.runtime_loader` reads local runtime packages:

- `local_persona_package`: `SKILL.md`, `persona.json`, optional case/eval assets
- `local_agent_skill`: `SKILL.md`, optional `SOURCE.md`
- `inline_prompt`: in-memory prompt

Remote personas are schema-level placeholders and are not executed by default.

### Executor

`persona_router.executor` currently provides a deterministic mock executor. It appends turns to session state and includes runtime/source metadata, but does not call an LLM.

The next executor version should construct per-agent prompts, merge boundaries, and call the configured model.

### CLI

`persona_router.cli` exposes the current minimum developer workflow:

- validate
- list-agents
- session new
- active
- round
- next

## Data Flow

```text
user input
→ command parser
→ session state update
→ turn planner
→ runtime loader
→ executor
→ appended turns
→ saved session
```

## Persistence

Sessions are stored as JSON files under:

```text
.persona-router/sessions/<session_id>.json
```

This is intentionally simple. A future API server can replace it with SQLite without changing the registry/session contracts.

