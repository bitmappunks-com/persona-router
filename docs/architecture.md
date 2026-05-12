# Persona Router Architecture

A small core. The router owns addressability, active state, turn ordering, runtime loading, and LLM dispatch. It does **not** own persona content.

## Top-level layout

```
persona-router/
├── imported-personas/             # imported third-party Agent Skills (read-only)
├── local-personas/                 # homegrown persona packages
├── skills/persona-author/          # the SKILL that teaches how to write a local persona
├── persona_router/                 # everything backend
│   ├── api.py, registry.py, ...    # FastAPI + Python package
│   ├── schemas/                    # JSON schemas (persona-agent, persona-session, turn-plan, round-result)
│   ├── registries/                 # local.json + imported.json (travel with the install)
│   ├── evals/                      # router eval cases
│   ├── tests/                      # pytest + fixtures
│   ├── scripts/                    # audit / import / run-evals operational scripts
│   └── web/                        # built React UI served by FastAPI
├── frontend/                       # Vite + React source (built into persona_router/web/)
├── docs/                           # this file (architecture only)
├── Makefile, pyproject.toml, README.md, .env.example, .github/
```

Five top-level concerns, each with one clear directory. Everything operational about the backend (config, tests, evals, scripts, schemas) sits inside `persona_router/` so the boundary is unambiguous.

## Concepts

**Persona** — a `local-personas/<name>/` or `imported-personas/<name>/` package. An auditable bundle of `SKILL.md` + `persona.json` (for local) plus optional corpus/evidence/tests. Answers "how does this voice think and express itself."

**Agent** — a session-addressable wrapper around a persona. Adds `agent_id`, `handle`, `display_name`, `persona_ref`, `activation` policy, `dialogue` role, and registry-level `runtime_boundaries`. One persona can be wrapped as multiple agents (e.g. `@buffett` participant vs `@buffett_critic` reviewer).

**Session** — per-conversation state: `available_agent_ids`, `active_agent_ids`, `topic`, `round_index`, `turns`. Active state is session-local and never written back to registry files.

## Components

### Registry loader (`persona_router.registry`)

Loads one or more registry files, validates against `persona_router/schemas/persona-agent.schema.json`, resolves handles + aliases, validates that local runtime entrypoints exist on disk.

Default registry order:

1. `persona_router/registries/local.json` (bundled with the install)
2. `persona_router/registries/imported.json` (bundled with the install)
3. `agents.local.json` at the repo root, if present (operator additions)

### Command parser (`persona_router.commands`)

Parses user input into `(intent, mentioned_handles, topic, round_instruction)`. Intents: `set_active`, `activate`, `deactivate`, `topic_with_mentions`, `topic`, `next_round`, `list_agents`.

### Session manager (`persona_router.session`)

Persists per-conversation state. Sessions are written to `.persona-router/sessions/<session_id>.json`.

Recognized control intents:

| Input | Effect |
|---|---|
| `active @a @b` | replace active set with `[a, b]` |
| `activate @a` | add `a` to active set |
| `deactivate @a` | remove `a` from active set |
| `@a @b <topic>` | update topic; activate `a`,`b` per `mention_activation_mode` |
| `next round` / `再讨论一轮` | run another round with current active set |

Default `mention_activation_mode = "replace_for_topic"`: when input contains a fresh topic with mentions, replace the active set with the mentioned agents.

### Turn planner (`persona_router.planner`)

Deterministic round build:

1. user `@`-mention order first
2. otherwise `active_agent_ids` order
3. agents with `dialogue.role = "moderator"` move to the end unless explicitly `@`-mentioned

Respects `turn_policy` (`speak_when_active_or_mentioned`, `speak_only_when_mentioned`, `moderate_after_participants`).

### Runtime loader (`persona_router.runtime_loader`)

Reads local runtime packages:

- `local_persona_package` — full bundle: `SKILL.md`, `persona.json`, optional `corpus/`, `evidence/`, `cases.jsonl`, `evals.md`
- `local_agent_skill` — just a `SKILL.md` entrypoint with optional `SOURCE.md`
- `inline_prompt` — in-memory prompt for tiny stub agents

`remote_persona` is a schema-level placeholder; not executed.

### Executor (`persona_router.executor` + `persona_router.llm`)

Two paths share the same `LLMClient` protocol:

- `run_mock_round` — deterministic, no API call. Used when no key is configured and in tests.
- `run_llm_round` — calls the configured `LLMClient`.

`persona_router.llm.OpenAICompatibleClient` is the default adapter; it works with any OpenAI Chat Completions endpoint. Provider selection from env:

| Variable | Effect |
|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek at `api.deepseek.com/v1`, model defaults to `deepseek-chat` |
| `OPENAI_API_KEY` | OpenAI at `api.openai.com/v1`, model defaults to `gpt-4o-mini` |
| `PERSONA_ROUTER_API_KEY` + `PERSONA_ROUTER_BASE_URL` | fully custom endpoint |
| `PERSONA_ROUTER_MODEL` | override model |
| `PERSONA_ROUTER_TEMPERATURE` | default `0.4` |

`.env` at the repo root is loaded automatically via `python-dotenv`. `/health` reports which mode is active.

### Boundaries

Persona output is a reasoning perspective, not a real identity claim. Boundaries merge in this order (later layers can only tighten):

1. Global router boundaries
2. Registry-level `runtime_boundaries`
3. Persona package `runtime_boundaries`

Defaults:

- No real-identity claims, no private thoughts, no current holdings, no live private decisions.
- Current-fact questions (stock prices, leadership, regulations, medical, live politics) are flagged via `assess_boundaries` and the response is marked `needs_verification`.
- High-risk advice is downgraded to general principles.
- Third-party community Agent Skills retain `SOURCE.md` attribution.

### API + CLI

`persona_router.api` is a FastAPI app:

| Route | Purpose |
|---|---|
| `GET /` + SPA fallback | serves the built React UI |
| `GET /static/*` | UI assets |
| `GET /health` | LLM mode + provider/model |
| `GET /agents` | full registry summary (with stance, boundaries, source metadata) |
| `POST /sessions` | new session |
| `GET /sessions/{id}` | load session |
| `POST /sessions/{id}/active` | set active handles |
| `POST /sessions/{id}/round` | parse user input + run a round |
| `POST /sessions/{id}/next` | run another round with current cast |

`persona_router.cli` exposes the same operations: `validate`, `list-agents`, `session new|active|round|next`.

## Data flow

```
user input
  → command parser
  → session state update
  → turn planner
  → runtime loader (reads persona package)
  → executor (mock or LLM)
  → turns appended to session
  → JSON persisted to .persona-router/sessions/
```

## Provenance

Imported community Agent Skills are recorded in `imported-personas/SOURCES.jsonl` (upstream repo, commit, import date, license_status). Most originate from [`xixu-me/awesome-persona-distill-skills`](https://github.com/xixu-me/awesome-persona-distill-skills) under the public-figure / methodology category. Some upstream snapshots lacked a root license file; those are marked `license_missing` in `SOURCES.jsonl` and in each package's `SOURCE.md`. Verify upstream licensing before redistribution.

Local persona packages under `local-personas/` are produced via the workflow described in `skills/persona-author/SKILL.md`. The full authoring spec lives at `skills/persona-author/reference/spec.md`.
