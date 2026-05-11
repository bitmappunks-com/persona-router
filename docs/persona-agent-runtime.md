# Persona Agent 运行定义

本文定义 persona-router 的第一层运行协议：如何把 persona 包装成可激活的 agent，以及如何在一个会话里控制哪些 agent 参与讨论。

## 目标

支持以下交互：

```text
active @buffett @munger
topic: 现在的 AI 投资热是否像过去的铁路或互联网泡沫？

next round
deactivate @munger
active @operator
next round
```

运行时必须能回答三个问题：

1. 当前有哪些 agent 可用。
2. 当前哪些 agent active。
3. 一轮讨论中，哪些 active agent 应该按什么顺序发言。

## 概念

### Persona

`persona` 是一个可审计的角色包，回答“这个角色如何思考和表达”。例如现有的 `local-personas/warren-buffett-perspective/persona.json`。

persona 不直接等同会话成员。一个 persona 可以被包装成一个或多个 agent，例如：

- `@buffett`: 使用 Buffett persona 的主要发言 agent。
- `@buffett_critic`: 使用同一证据包，但 turn role 是批判性审查。

### Agent

`agent` 是会话中的可寻址成员，回答“我可以 @ 谁、谁现在 active、下一轮谁说话”。

每个 agent 至少包含：

- `agent_id`: 稳定机器 ID。
- `handle`: 用户可输入的 @ 名称。
- `display_name`: UI 显示名。
- `persona_ref`: 指向 persona 包、Agent Skill 包或 prompt 定义。
- `activation`: 这个 agent 如何被激活、停用、默认是否参与。
- `dialogue`: 多 agent 讨论时的职责和发言策略。
- `runtime_boundaries`: 会话级限制，不能覆盖 persona 自身安全边界。

### Session

`session` 是一次对话状态，保存：

- `available_agents`: 本会话允许使用的 agent。
- `active_agent_ids`: 当前 active 的 agent。
- `topic`: 当前讨论主题。
- `round_index`: 当前轮次。
- `turns`: 已发生的发言记录。

## Agent 定义

推荐文件名：`agents.json` 或 `persona-registry.json`。结构可用 [persona-agent.schema.json](/Users/ttu/projects/persona-router/persona_router/schemas/persona-agent.schema.json) 校验。

最小结构：

```json
{
  "schema_version": "0.1.0",
  "agents": [
    {
      "agent_id": "buffett",
      "handle": "buffett",
      "display_name": "Warren Buffett Perspective",
      "persona_ref": {
        "type": "local_persona_package",
        "path": "local-personas/warren-buffett-perspective",
        "entrypoint": "SKILL.md",
        "persona_json": "persona.json"
      },
      "activation": {
        "default_active": false,
        "allow_manual_toggle": true,
        "aliases": ["warren", "巴菲特"]
      },
      "dialogue": {
        "role": "participant",
        "stance": "owner-oriented capital allocator",
        "turn_policy": "speak_when_active_or_mentioned",
        "max_words_per_turn": 220,
        "can_question_others": true
      },
      "runtime_boundaries": [
        "Use persona voice only; do not claim real identity.",
        "Verify current facts before relying on post-cutoff information."
      ]
    }
  ]
}
```

如果迁移的是标准 Agent Skill，且只有 `SKILL.md` 入口、没有本仓库完整 `persona.json` 运行包，则使用：

```json
{
  "persona_ref": {
    "type": "local_agent_skill",
    "path": "community-personas/feynman-skill",
    "entrypoint": "SKILL.md"
  }
}
```

`local_agent_skill` 可参与 active agent 调度，但应在 `metadata` 或 `SOURCE.md` 中记录上游来源，并通过 `runtime_boundaries` 标明第三方来源和事实查证边界。

## Active 控制

router 必须把 active 状态当作会话状态，而不是写回 agent 定义。

支持的控制意图：

| 用户输入 | 语义 |
|---|---|
| `active @a @b` | 将当前 active agent 设置为 `a`、`b` |
| `activate @a` | 在当前 active 集合中加入 `a` |
| `deactivate @a` | 从当前 active 集合中移除 `a` |
| `only @a` | 等价于 `active @a` |
| `@a @b <topic>` | 若带主题，临时激活 `a`、`b` 并开始/更新主题 |
| `next round` / `再讨论一轮` | 使用当前 active agent 继续一轮 |

如果用户只 @ 了 agent，但没有明确 active 命令：

1. 本轮至少让被 @ 的 agent 发言。
2. 是否写入 `active_agent_ids` 由 `mention_activation_mode` 决定。
3. 默认建议 `mention_activation_mode = "replace_for_topic"`：当输入包含新主题时，用被 @ 的 agent 替换 active 集合。

## 讨论轮次

一轮讨论的推荐流程：

```text
Input topic
→ resolve mentioned agents
→ update active_agent_ids
→ build round plan from active agents
→ each agent reads its persona runtime package
→ agent emits one turn
→ optional moderator summary
→ store turns and increment round_index
```

默认 turn 顺序：

1. 按用户 @ 的顺序。
2. 没有 @ 顺序时，按 `active_agent_ids` 顺序。
3. 如果存在 `dialogue.role = "moderator"`，moderator 默认最后总结，除非用户直接 @ moderator。

## Session 状态

session 状态可用 [persona-session.schema.json](/Users/ttu/projects/persona-router/persona_router/schemas/persona-session.schema.json) 校验。示例见 [session-state.json](/Users/ttu/projects/persona-router/tests/fixtures/session-state.json)。

示例：

```json
{
  "session_id": "sess_001",
  "topic": "现在的 AI 投资热是否像过去的铁路或互联网泡沫？",
  "available_agent_ids": ["buffett", "operator"],
  "active_agent_ids": ["buffett", "operator"],
  "mention_activation_mode": "replace_for_topic",
  "round_index": 2,
  "turns": [
    {
      "round_index": 1,
      "agent_id": "buffett",
      "trigger": "mentioned",
      "content": "..."
    }
  ]
}
```

## Router 规则

router 实现时必须遵守：

- `active_agent_ids` 只能包含 registry 中存在且 `enabled = true` 的 agent。
- 用户显式 active 命令优先于默认 active。
- 用户 @ 的 agent 优先参与当前轮，即使它之前不是 active。
- agent 的 `runtime_boundaries` 只能收紧，不能放宽 persona 包中的边界。
- 高风险、隐私、冒充、事实时效问题由每个 persona 自身边界处理；router 只负责调度。
- 如果 active 集合为空，并且用户没有 @ agent，router 应返回可用 agent 列表或使用默认 agent，具体由产品层配置。

## 后续实现接口

建议 router 暴露四个核心操作：

```text
list_agents() -> Agent[]
set_active(session_id, handles[]) -> Session
resolve_turn_plan(session, user_input) -> TurnPlan
run_round(session, topic_or_instruction) -> RoundResult
```

`run_round` 不应直接改写 persona 定义；它只读取 persona 包并追加 session turns。
