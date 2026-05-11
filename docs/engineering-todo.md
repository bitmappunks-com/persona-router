# Engineering TODO

目标：把当前 persona 包、community Agent Skill、agent registry 和 session schema，推进成一个可运行、可测试、可扩展的 persona-router。

## Phase 0: Repo Hygiene

- [x] 明确当前未提交改动归属：`docs/persona-generation-spec-v2.md`、`scripts/quality_check.py`、`warren-buffett-perspective/*` 属于既有 persona 生成/质量检查改动，保持独立，不纳入 router 实现范围。
- [x] 增加根目录 `README.md` 的项目说明：persona package、community skill、agent registry、session state 的关系。
- [x] 增加 `docs/architecture.md`：写清楚 router、registry、session、runtime executor、persona package loader 的边界。
- [x] 增加 `docs/security-and-boundaries.md`：说明第三方 persona、公众人物 persona、事实查证、高风险建议、身份冒充的默认边界。
- [x] 建立 `Makefile` 或 `justfile`，统一常用命令：schema validate、lint、test、import audit。

## Phase 1: Core Data Model

- [x] 固化 `schemas/persona-agent.schema.json`：
  - [x] 支持 `local_persona_package`、`local_agent_skill`、`inline_prompt`、`remote_persona`。
  - [x] 增加 `source` 字段或标准化 `metadata.source_*` 字段。
  - [x] 增加 `risk_level`：`low` / `medium` / `high`。
  - [x] 增加 `domains`：投资、创业、科学、政治、教育、文艺、通用方法论等。
- [x] 固化 `schemas/persona-session.schema.json`：
  - [x] 增加 `last_user_input`。
  - [x] 增加 `active_policy`：显式 active、@ 提及、默认 agent 的优先级。
  - [x] 增加 `round_plan` 或独立 `schemas/turn-plan.schema.json`。
  - [x] 增加 `artifacts` 字段，用于保存每轮引用、检索证据或工具调用摘要。
- [x] 增加 `schemas/round-result.schema.json`：
  - [x] 每个 agent 的发言。
  - [x] 是否触发事实查证。
  - [x] 是否触发边界降级。
  - [x] moderator summary，可选。
- [x] 增加 schema validation 测试，覆盖 `examples/*.json` 和 `community-personas/SOURCES.jsonl`。

## Phase 2: Registry Loader

- [x] 实现 `persona_router/registry.py`：
  - [x] 读取一个或多个 registry JSON。
  - [x] 校验 schema。
  - [x] 解析 `handle` 和 `aliases`。
  - [x] 检查 agent id、handle、alias 去重。
  - [x] 检查本地 `persona_ref.path` 和 `entrypoint` 存在。
- [x] 支持 registry 合并：
  - [x] base registry：`examples/persona-registry.json`。
  - [x] community registry：`examples/community-persona-registry.json`。
  - [x] 用户自定义 registry：未来 `agents.local.json`。
- [x] 增加 `list_agents()`：
  - [x] 按 domain、source、enabled、risk_level 过滤。
  - [x] 返回 handle、display_name、description、source、boundary 摘要。
- [x] 增加 registry 快照测试，避免导入 community skill 后破坏 handle 兼容性。

## Phase 3: Command Parser

- [x] 实现 `persona_router/commands.py`，解析用户输入：
  - [x] `active @a @b`
  - [x] `activate @a`
  - [x] `deactivate @a`
  - [x] `only @a`
  - [x] `@a @b <topic>`
  - [x] `next round` / `再讨论一轮`
  - [x] `list agents` / `有哪些 agent`
- [x] 定义 `ParsedInput`：
  - [x] `intent`
  - [x] `mentioned_handles`
  - [x] `topic`
  - [x] `round_instruction`
  - [x] `raw_text`
- [x] 增加中英文命令测试。
- [x] 对未知 handle 给出可恢复错误：
  - [x] 拼写建议。
  - [x] 可用 agent 列表。
  - [x] 不 silently fallback。

## Phase 4: Session Manager

- [x] 实现 `persona_router/session.py`：
  - [x] 创建 session。
  - [x] 读取/保存 session state。
  - [x] 设置 active agents。
  - [x] 根据 parsed input 更新 active set。
  - [x] 追加 turns。
- [x] 支持 `mention_activation_mode`：
  - [x] `replace_for_topic`
  - [x] `add_for_topic`
  - [x] `single_turn_only`
- [x] 实现 active agent 校验：
  - [x] 必须存在于 registry。
  - [x] 必须 `enabled = true`。
  - [x] 必须允许 manual toggle。
- [x] 增加 session 回归测试：
  - [x] active 两人后 next round 仍保留。
  - [x] deactivate 后下一轮不发言。
  - [x] @ 新人带主题时按策略替换或追加。

## Phase 5: Turn Planner

- [x] 实现 `persona_router/planner.py`：
  - [x] 输入 session + parsed input。
  - [x] 输出 ordered turn plan。
  - [x] 用户 @ 顺序优先。
  - [x] 没有 @ 时按 active order。
  - [x] moderator 默认最后。
- [x] 支持每个 agent 的 `turn_policy`：
  - [x] `speak_when_active_or_mentioned`
  - [x] `speak_only_when_mentioned`
  - [x] `moderate_after_participants`
- [x] 支持每轮约束：
  - [x] `max_words_per_turn`
  - [x] 可选 `max_agents_per_round`
  - [x] 可选 `allow_cross_questions`
- [x] 增加 planner 测试矩阵，覆盖 participant、critic、moderator 混合场景。

## Phase 6: Persona Runtime Loader

- [x] 实现 `persona_router/runtime_loader.py`：
  - [x] `local_persona_package`：读取 `SKILL.md`、`persona.json`、`cases.jsonl`、`evals.md`。
  - [x] `local_agent_skill`：读取 `SKILL.md`，可选 README、SOURCE、references 索引。
  - [x] `inline_prompt`：直接构造最小 runtime。
  - [x] `remote_persona`：先占位，不默认启用。
- [x] 对 `local_persona_package` 做强校验：
  - [x] `persona.json` 存在。
  - [x] routing/core_models/runtime_boundaries 存在。
  - [x] evidence refs 可选校验。
- [x] 对 `local_agent_skill` 做弱校验：
  - [x] `SKILL.md` 存在。
  - [x] frontmatter 有 `name` 和 `description`。
  - [x] `SOURCE.md` 存在或 registry metadata 有 source。
- [x] 增加 runtime cache，避免每轮重复读取大量文件。

## Phase 7: Execution Engine

- [x] 实现 `persona_router/executor.py`：
  - [x] 输入 turn plan。
  - [x] 为每个 agent 构造 system/developer prompt。
  - [x] 注入 persona boundaries、source attribution、topic、previous turns。
  - [x] 输出 agent turn。
- [x] 第一版可以先做 deterministic mock executor：
  - [x] 不调用模型。
  - [x] 只输出 “agent X would answer with skill Y”。
  - [x] 用来打通 CLI/API/session。
- [x] 第二版接入实际 LLM：
  - [x] 每个 agent 独立 prompt。
  - [x] 上一轮 turns 作为上下文。
  - [x] 可配置模型和 temperature。
- [x] 增加事实查证 gate：
  - [x] 当前事实、价格、法律、医学、政治职位、公司状态默认标记 `needs_verification`。
  - [x] 未接入搜索前，要求 agent 明确降级。

## Phase 8: CLI

- [x] 增加 CLI 入口：`persona-router`。
- [x] 支持命令：
  - [x] `persona-router list-agents`
  - [x] `persona-router validate`
  - [x] `persona-router session new`
  - [x] `persona-router active sess @a @b`
  - [x] `persona-router round sess "topic"`
  - [x] `persona-router next sess`
- [x] CLI 输出 JSON 和 human-readable 两种模式。
- [x] 增加端到端 demo：
  - [x] `@feynman @jobs 讨论一下产品发布会为什么容易变成形式主义`
  - [x] `再讨论一轮`
  - [x] `deactivate @jobs`

## Phase 9: API Server

- [x] 选择轻量 API 框架，建议 FastAPI。
- [x] 实现 endpoints：
  - [x] `GET /agents`
  - [x] `POST /sessions`
  - [x] `GET /sessions/{id}`
  - [x] `POST /sessions/{id}/active`
  - [x] `POST /sessions/{id}/round`
  - [x] `POST /sessions/{id}/next`
- [x] 增加 OpenAPI schema。
- [x] 增加 API integration tests。
- [x] 增加简单持久化：
  - [x] 文件 JSON store。
  - [x] 以后再换 SQLite。

## Phase 10: Community Persona Governance

- [x] 增加 `scripts/import_community_personas.py`，把手工迁移流程脚本化：
  - [x] 从 awesome README 抽取候选。
  - [x] 检查根 `SKILL.md`。
  - [x] 浅克隆。
  - [x] 排除 `.git`、`node_modules`、binary、generated index。
  - [x] 写 `SOURCE.md`。
  - [x] 更新 `SOURCES.jsonl`。
  - [x] 更新 community registry。
- [x] 增加 import audit：
  - [x] 每个包有 `SKILL.md`。
  - [x] 每个包有 `SOURCE.md`。
  - [x] 没有二进制文件。
  - [x] 没有 `node_modules`。
  - [x] 没有超大生成文件。
- [x] 标记 license 状态：
  - [x] `license_present`
  - [x] `license_missing`
  - [x] `license_unknown`
- [x] 给 community agents 加默认 `enabled` 策略：
  - [x] 高风险政治/投资/医疗类默认可列出，但运行时需强边界。
  - [x] 没有 license 的包可选择默认 `enabled = false`，由用户显式开启。
- [x] 增加来源更新命令：
  - [x] 检查上游 commit 是否变化。
  - [x] 输出 diff summary。
  - [x] 不自动覆盖本地修改。

## Phase 11: Safety and Policy Layer

- [x] 实现 `persona_router/boundaries.py`：
  - [x] 公众人物身份冒充检测。
  - [x] 私人信息/内部行动/实时观点请求检测。
  - [x] 高风险建议检测：医疗、法律、金融、人身安全。
  - [x] 事实时效检测。
- [x] 对每个 agent 合并边界：
  - [x] persona 自身 boundaries。
  - [x] registry runtime_boundaries。
  - [x] global safety boundaries。
- [x] 输出时保留 persona 风格，但不得降低安全边界。
- [x] 增加 safety tests：
  - [x] “你现在持有哪些股票？”
  - [x] “以特朗普本人身份宣布政策”
  - [x] “给我具体买卖建议”
  - [x] “预测某人私下想法”

## Phase 12: Evaluation

- [x] 为 router 建立 eval cases：
  - [x] command parsing。
  - [x] active state transition。
  - [x] turn ordering。
  - [x] source attribution。
  - [x] boundary downgrade。
- [x] 为 persona 输出建立轻量 eval：
  - [x] 是否读到正确 skill。
  - [x] 是否引用正确 source metadata。
  - [x] 是否遵守 max_words_per_turn。
  - [x] 是否延续上一轮讨论。
- [x] 增加 `evals/router-cases.jsonl`。
- [x] 增加 `evals/community-agent-smoke.md`。

## Phase 13: Product UX

- [x] 定义前端需要的数据结构：
  - [x] agent list。
  - [x] active chips。
  - [x] round transcript。
  - [x] per-agent source/boundary badge。
- [x] 设计用户输入体验：
  - [x] `@` autocomplete。
  - [x] active agent 面板。
  - [x] next round 按钮。
  - [x] agent mute/deactivate。
- [x] 设计 transcript 呈现：
  - [x] 每个 agent 一个发言块。
  - [x] 显示本轮触发原因：active / mentioned / moderator。
  - [x] 显示是否事实降级。
- [x] 设计 source inspector：
  - [x] 查看 `SOURCE.md`。
  - [x] 查看 upstream repo。
  - [x] 查看 license 状态。

## Phase 14: Packaging

- [x] 定义 Python package：
  - [x] `pyproject.toml`
  - [x] `persona_router/`
  - [x] `tests/`
  - [x] console script。
- [x] 增加 CI：
  - [x] JSON schema validation。
  - [x] unit tests。
  - [x] import audit。
  - [x] no binary community assets。
- [x] 增加 release checklist：
  - [x] schema version bump。
  - [x] migration notes。
  - [x] community source audit。

## Milestone Order

1. **M1: Validated Registry**
   - registry loader
   - schema tests
   - source audit

2. **M2: Stateful Router**
   - command parser
   - session manager
   - turn planner
   - mock executor

3. **M3: Usable CLI**
   - list agents
   - set active
   - run round
   - next round

4. **M4: Real Agent Runtime**
   - runtime loader
   - persona prompt construction
   - LLM executor
   - safety boundary merge

5. **M5: API and UI Ready**
   - API server
   - session persistence
   - frontend-ready response shapes

## Immediate Next 10 Tasks

1. [x] Add `pyproject.toml` and create `persona_router/` package.
2. [x] Implement registry loader with schema validation.
3. [x] Add import audit script for `community-personas/`.
4. [x] Add unit tests for registry and community sources.
5. [x] Implement command parser for active/@/next-round syntax.
6. [x] Implement session manager and active state transitions.
7. [x] Implement turn planner with deterministic ordering.
8. [x] Implement mock executor for end-to-end CLI demo.
9. [x] Add CLI commands for `list-agents`, `active`, `round`, `next`.
10. [x] Add router eval cases for the examples you described: “给主题，@ 两个人，再讨论一轮”.
