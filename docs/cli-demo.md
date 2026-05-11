# CLI Demo

This demo exercises the core flow: choose two agents, run a discussion round, continue one more round, deactivate one agent, and continue again.

```bash
SESSION_ID=$(python3 -m persona_router.cli --json session new | python3 -c 'import json,sys; print(json.load(sys.stdin)["session"]["session_id"])')

python3 -m persona_router.cli --json round "$SESSION_ID" "@feynman @steve_jobs 讨论一下产品发布会为什么容易变成形式主义"

python3 -m persona_router.cli --json next "$SESSION_ID"

python3 -m persona_router.cli --json round "$SESSION_ID" "deactivate @steve_jobs"

python3 -m persona_router.cli --json next "$SESSION_ID"
```

Current behavior uses the mock executor, so outputs prove routing and state transitions rather than final persona answer quality.

