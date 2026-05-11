# Community Agent Smoke Evals

These smoke cases validate router mechanics, not persona answer quality.

1. `@feynman @steve_jobs 讨论一下产品发布会为什么容易变成形式主义`
   - Expected: both handles resolve.
   - Expected: active agents become `community_feynman`, `community_steve_jobs`.
   - Expected: round 1 emits two mock turns in mention order.

2. `再讨论一轮`
   - Expected: same active agents speak again.
   - Expected: triggers are `active`.

3. `deactivate @steve_jobs`
   - Expected: `community_steve_jobs` is removed from active agents.
   - Expected: next round emits only `community_feynman`.

