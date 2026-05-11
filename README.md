# Persona Router

Persona Router is a stateful routing layer for persona packages and community Agent Skills.

It separates four concerns:

- **Persona package**: the evidence-backed role package, such as `warren-buffett-perspective/`.
- **Community Agent Skill**: imported third-party skills under `community-personas/`.
- **Agent registry**: the address book that maps handles such as `@feynman` to a runtime package.
- **Session state**: the active agents, topic, round index, and transcript for a conversation.

The intended interaction model is:

```text
@feynman @steve_jobs 讨论一下产品发布会为什么容易变成形式主义
再讨论一轮
deactivate @steve_jobs
再讨论一轮
```

## Quick Start

Validate registries and imported community skills:

```bash
make validate
```

List available agents:

```bash
python3 -m persona_router.cli --json list-agents
```

Create a session:

```bash
python3 -m persona_router.cli --json session new
```

Run a mock round:

```bash
python3 -m persona_router.cli --json round <session_id> "@feynman @steve_jobs 讨论产品发布"
python3 -m persona_router.cli --json next <session_id>
```

Run the API server:

```bash
uvicorn persona_router.api:app --reload
```

The current executor is intentionally a deterministic mock executor. It proves registry loading, active-agent state, turn planning, runtime loading, and transcript persistence before real LLM execution is connected.

## Key Paths

- `persona_router/`: Python router package.
- `schemas/`: JSON schemas for registry, session, turn plan, and round result.
- `examples/persona-registry.json`: local full persona registry example.
- `examples/community-persona-registry.json`: imported community Agent Skill registry.
- `community-personas/`: third-party imported Agent Skill text packages.
- `docs/engineering-todo.md`: engineering roadmap and remaining work.
- `docs/architecture.md`: system architecture.
- `docs/security-and-boundaries.md`: default safety and attribution boundaries.

## Verification

```bash
make test
make audit-community
make validate
```

If local pytest plugin autoloading is broken, use:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest
```
