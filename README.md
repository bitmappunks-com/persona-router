# Persona Router

Persona Router is a stateful routing layer for persona packages and community Agent Skills.

It separates four concerns:

- **Local persona packages**: homegrown role packages under `local-personas/` (e.g. `local-personas/warren-buffett-perspective/`). New skills you author belong here.
- **Community Agent Skills**: imported third-party skills under `community-personas/`.
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

### Configure the LLM provider

The server reads credentials from `.env` at the repo root on startup. Copy the template and fill it in:

```bash
cp .env.example .env
# edit .env and set DEEPSEEK_API_KEY=... (or OPENAI_API_KEY=...)
pip install -e '.[llm]'
```

Supported providers (OpenAI-compatible):

| Variable                | Default                         |
| ----------------------- | ------------------------------- |
| `DEEPSEEK_API_KEY`      | DeepSeek (`api.deepseek.com/v1`) |
| `OPENAI_API_KEY`        | OpenAI (`api.openai.com/v1`)    |
| `PERSONA_ROUTER_API_KEY` + `PERSONA_ROUTER_BASE_URL` | custom OpenAI-compatible endpoint |
| `PERSONA_ROUTER_MODEL`  | `deepseek-chat` / `gpt-4o-mini` |
| `PERSONA_ROUTER_TEMPERATURE` | `0.4`                      |

Without any key the server falls back to a deterministic mock executor — useful for UI work. The current mode is reported at `GET /health`.

### Frontend (React + Vite)

The bundled frontend lives in `frontend/` (source) and is built into `persona_router/web/` (served by FastAPI under `/static`).

```bash
make web-install   # one-time: install npm deps
make web-build     # produce production bundle into persona_router/web/
make web           # start FastAPI on :8000 — open http://127.0.0.1:8000/
```

For hot-reload frontend development, run both:

```bash
make web           # terminal 1: FastAPI on :8000
make web-dev       # terminal 2: Vite on :5173 (proxies API to :8000)
```

Check the active runtime mode at any time:

```bash
curl http://127.0.0.1:8000/health
```

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
python3 -m uvicorn persona_router.api:app --reload --host 127.0.0.1 --port 8000
```

The web UI lets you select active agents, inspect source/license/risk metadata, run a topic round, continue the next round, and deactivate agents. The default executor is still deterministic mock execution; it proves registry loading, active-agent state, turn planning, runtime loading, and transcript persistence before a real LLM provider is plugged in.

## Key Paths

## Layout

```
persona-router/
├── community-personas/         # imported third-party Agent Skills
├── local-personas/             # locally authored persona packages
├── skills/persona-author/      # SKILL teaching how to author a local persona
├── persona_router/             # backend: api, registry, schemas, registries,
│                               # tests, scripts, evals, built UI bundle (web/)
├── frontend/                   # Vite + React source (builds into persona_router/web/)
└── docs/architecture.md        # single architecture document
```

See [`docs/architecture.md`](docs/architecture.md) for the full system explanation.

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
