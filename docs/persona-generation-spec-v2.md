# Persona 生成规范 v2

> 目标：把一个人、组织、角色或主题，蒸馏成可运行、可审计、可更新的 persona skill。  
> 核心原则：先归档原始数据，再建立证据账本，再提炼认知模型，最后生成运行时 persona。不要从印象、搜索摘要或未落盘来源直接写 persona。

本规范基于 `nuwa-skill`（女娲 · Skill造人术）的 persona 蒸馏方法论修改而来，保留其“多源调研 → 思维框架提炼 → 可运行 Skill 生成 → 质量验证”的主线，并进一步细化数据采集、来源过滤、证据账本、运行时 schema 和迭代式全面采集规则。

## 0. 不可跳过的前置原则

persona 生成的第一步不是写 `SKILL.md`，也不是先填 `sources.jsonl`。第一步必须是把可准入来源的原始内容下载、导出或保存到 `corpus/raw/`。后续的来源账本、摘录、研究摘要、心智模型和运行时 persona 都必须从这些本地归档数据中产生。

硬性要求：

- **先归档，再分析**：搜索结果、网页片段、AI 摘要、浏览器临时读取内容只能用于发现线索，不能直接进入 `excerpts.jsonl`，也不能支撑 `SKILL.md`。
- **证据必须可复查**：任何 `accepted` 或 `limited` 来源都必须有 `raw_path`，指向 `corpus/raw/` 下保存的原文、PDF、音视频转写、社交导出、决策材料或外部文章副本。
- **有效载荷先于文件存在**：`raw_path` 存在不等于来源可用。必须确认本地文件包含可摘录的正文、转写、问答、决策记录或可解析数据；索引页、视频卡片页、播放器壳、跳转页、空 PDF、只有附件链接的 HTML、只有 metadata/广告/脚本的页面不得标记为 `accepted`。
- **来源独立性先于数量**：同一作者、同一栏目、同一发布机制、同一年度系列或同一档节目连续多期，不能机械拆成几十个“独立来源”来制造虚假覆盖。必须同时统计 `raw_item_count` 和 `independent_source_count`。
- **原始数据优先于解释**：如果只能拿到二手转述，必须继续追溯原文；追溯失败时只能写入 `source-quality.md` 的未验证线索，不能支撑核心模型。
- **全面性先于达标停止**：不要因为达到某个数量线就停止采集。公开材料丰富的人物必须通过多轮“发现 → 过滤 → 采集 → 诊断 → 再发现”迭代，尽可能覆盖互联网上可取得、可审计、可追溯的材料。
- **质量门槛只用于准入，不用于提前收工**：`valid` / `partial` / `shell` / `failed` 的判断决定材料能否进入证据链；数量和覆盖统计用于暴露缺口、决定交付状态，而不是作为“够了就不搜”的理由。
- **不得偷工减料**：不能用少量高层总结、语录拼贴、搜索摘要或模型常识替代数据采集。公开材料丰富的人物必须按 A 档标准采集；材料不足不是降低标准的理由，而是降级交付状态的理由。
- **research 必须像研究，不是摘要**：`research/*.md` 必须展示证据链、反证、分歧、缺口和推断过程。只有几段结论、只有来源列表、只有自动生成的笼统总结，都不得进入 persona 提炼阶段。

生成顺序必须是：

```text
1. 搜索和发现候选来源
2. 过滤垃圾来源并追溯 canonical 原始来源
3. 下载/导出/保存原始数据到 corpus/raw/
4. 基于 raw_path 写 sources.jsonl
5. 从本地 raw 数据摘录并写 excerpts.jsonl
6. 基于 excerpts 写 research/ 和 evidence/
7. 最后生成 SKILL.md 和 persona.json
8. 运行质量检查和回归测试
```

如果第 3 步没有完成，不得进入第 5-7 步。

每一步都有独立交付物和阶段门。不得把多个步骤合并成“边搜边写 persona”。尤其是 Step 1 和 Step 2：

- Step 1 只做搜索和发现，输出候选来源地图；不得下载 raw，不得写 excerpts，不得开始 research 结论。
- Step 2 只做过滤、去重、来源独立性判断和 canonical 追溯，输出准入队列；不得把未验证页面写成 accepted 来源。
- Step 3 才允许下载、导出或保存 raw。
- Step 4 才允许把通过 payload 验证的 raw 写入正式 `sources.jsonl`。
- Step 5 才允许摘录。
- Step 6 才允许写 research 和 evidence。

## 0.0 Discovery-Acquisition Iteration Loop

Step 1-3 不是一次性线性流程，而是一个必须重复执行的资料扩展循环：

```text
Iteration N
→ Step 1: 按上一轮缺口搜索候选
→ Step 2: 过滤、去重、canonical 追溯、写准入队列
→ Step 3: 下载/导出 raw，并验证 payload
→ Step 3.5: 诊断覆盖、失败、薄弱角度和污染来源
→ Iteration N+1: 用诊断结果反向设计下一轮搜索
```

### 0.0.1 迭代目标

每轮都必须回答：

- 这一轮补什么缺口：时间段、媒介、source cluster、失败争议、外部视角、短表达、互动模式、领域背景或近期材料。
- 哪些候选被拒绝，为什么拒绝。
- 哪些 raw 真的有效，哪些只是 shell、blocked、paywall、metadata、播放器或附件索引。
- 本轮之后还缺什么，下一轮搜索 query 应该如何改变。

### 0.0.2 迭代次数

- A 档公开材料丰富对象默认至少执行 5 轮 Step 1-3。
- B 档默认至少执行 3 轮。
- C 档默认至少执行 2 轮，除非用户提供的是封闭私有材料且互联网补源不适用。

达到某个数量线不得作为提前停止理由。可以停止迭代的理由只有：

- 连续两轮新增 `valid` / `partial` 独立来源簇极少，且 `source-quality.md` 说明已覆盖主要搜索空间。
- 继续采集需要付费库、登录账号、人工转写、版权授权或用户提供材料。
- 用户明确要求停止采集并进入 draft / partial persona。

### 0.0.3 每轮交付物

每轮必须追加或生成：

- `discovery/iterations/iteration-N-plan.md`
- `discovery/iterations/iteration-N-candidates.jsonl`
- `discovery/iterations/iteration-N-acquisition-queue.jsonl`
- `corpus/iteration-N-download-log.jsonl`
- `corpus/iteration-N-raw-acquisition-report.md`

主文件 `candidate-sources.jsonl`、`acquisition-queue.jsonl`、`rejected-candidates.jsonl` 和 `evidence/source-quality.md` 必须合并每轮结果，并保留去重和拒绝原因。

### 0.0.4 Step 3.5 质量诊断

每轮采集结束后，必须统计：

- `raw_item_count`
- `canonical_work_count`
- `independent_source_count`
- `valid` / `partial` / `shell` / `failed` 数量
- 视频/音频 transcript 小时数
- 官方字幕、人工字幕、自动字幕和人工转写的数量
- 9 个 research 维度的有效 source cluster 覆盖
- 失败/争议/外部视角材料占比
- 早期/中期/近期覆盖
- 被拦截、paywall、需要手工导出、需要 transcript/OCR 的材料
- 无字幕、只有短 highlight、第三方剪辑、说话人不明的视频候选数量
- 单一 source cluster 是否过度支配语料
- PDF 解析状态：下载的 PDF 数、已生成 text/OCR 版本的数量、`pdftotext`/OCR 失败数量、只保存二进制但没有可读文本的数量
- HTML 清洗状态：保存的 HTML 数、已生成 clean text 的数量、标签残留/导航模板/广告脚本污染数量、正文段落不足数量
- 索引/播放器/附件页误判风险：按词数看似 `valid` 但清洗分段后只剩导航、表格、链接、播放器卡片或访问拦截文案的来源数量

这些统计的用途是驱动下一轮搜索，而不是宣布“达标即可停止”。

## 0.1 Step 1：搜索和发现候选来源

Step 1 的目标不是“找够链接”，而是设计能支撑后续 9 个 research 维度的来源采样框架。搜索时必须预先想到 research 会问什么问题，从而主动寻找不同场景、不同媒介、不同动机和不同立场的原始材料。

### 0.1.1 输入

- persona 对象名称、别名、语言、职业阶段、主要领域。
- 初步对象档位：A/B/C。
- 9 个 research 维度：系统性表达、长对话、短表达、决策行动、失败争议、外部视角、时间线、领域背景、互动模式。

### 0.1.2 搜索矩阵

Step 1 必须先建立 `search-plan.md`，至少包含以下矩阵：

| Research 维度 | 需要的原始材料 | 搜索 query 模板 | 目标 source cluster | 当前候选 | 缺口 |
|---|---|---|---|---|---|
| 系统性表达 | 书、长文、信、论文、博客 | `"{name}" book OR essay OR letter` | 本人长文本 | - | - |
| 长对话 | 完整访谈、播客、AMA、年度会议 transcript | `"{name}" interview transcript`, `"{name}" podcast transcript` | 长对话 | - | - |
| 短表达 | 社交账号、短评论、邮件摘录、论坛回复 | `site:x.com "{handle}"`, official social export | 短表达 | - | - |
| 决策行动 | 公告、投资、产品变更、任命、辞职、交易文件 | `"{name}" acquisition filing`, `"{company}" annual report decision` | 决策记录 | - | - |
| 失败争议 | 道歉、诉讼、批评、失败复盘、反方文章 | `"{name}" criticism`, `"{name}" controversy primary source` | 反证/争议 | - | - |
| 外部视角 | 传记、深度报道、同行评价、批评者 | `"{name}" profile`, `"{name}" biography source notes` | 二手深度 | - | - |
| 时间线 | 年表、早期材料、近期材料、转折点 | `"{name}" early interview`, `"{name}" recent interview` | 阶段材料 | - | - |
| 领域背景 | 同代人、行业规范、对照对象 | `"{field}" contemporaries`, `"{name}" compared with` | 对照来源 | - | - |
| 互动模式 | Q&A、评论回复、学生/下属/媒体互动 | `"{name}" Q&A transcript`, `"{name}" shareholder meeting transcript` | 互动记录 | - | - |

### 0.1.3 多样性搜索规则

每轮搜索必须覆盖以下维度，不能只围绕最容易找到的一类材料：

- **媒介多样性**：文本、音视频 transcript、社交/短表达、决策文件、外部报道、批评材料至少各搜索一轮。
- **视频字幕专项**：公开材料丰富对象必须单独搜索 YouTube / Bilibili / 官方视频站的完整演讲、访谈、课堂、听证、股东会、AMA 或长 Q&A。视频候选不是网页正文候选，必须按字幕/转写来源处理。
- **时间多样性**：早期、中期、近期各搜索一轮；活人必须单独搜索最近 12 个月。
- **立场多样性**：本人自述、支持者、批评者、同行、受影响者各搜索一轮。
- **场景多样性**：正式写作、即兴问答、压力/失败场景、商业决策场景、私人或半私人互动记录分别搜索。
- **语言多样性**：对象跨语言活动时，必须用相关语言分别搜索。

### 0.1.4 Step 1 输出

Step 1 只输出 `discovery/candidate-sources.jsonl` 和 `discovery/search-plan.md`，不得写入正式 `corpus/sources.jsonl`。

`candidate-sources.jsonl` 每行必须包含：

```json
{
  "candidate_id": "cand_0001",
  "title": "Example interview transcript",
  "url": "https://example.com/interview",
  "discovered_via_query": "\"name\" interview transcript",
  "expected_source_tier": "P2",
  "expected_research_dimensions": ["long_conversations", "interaction_patterns"],
  "expected_source_cluster": "cluster_long_interviews",
  "expected_payload": "full_transcript",
  "expected_parse_artifacts": ["raw_html", "clean_text"],
  "payload_validation_plan": "clean HTML, remove navigation/templates, verify body paragraphs and transcript continuity",
  "canonicality_hypothesis": "official transcript linked from original publisher",
  "risk_flags": ["third_party_transcript"],
  "next_step": "trace_to_video_or_official_transcript"
}
```

### 0.1.5 Step 1 轮次完成条件

单轮 Step 1 进入 Step 2 前必须满足：

- 本轮搜索目标和缺口必须写入 `iteration-N-plan.md` 或 `search-plan.md`。
- 本轮候选必须标注对应的 research 维度和 source cluster。
- 本轮必须包含至少 3 类不同搜索方向；A 档优先覆盖 5 类以上。
- 活人或持续变化对象必须包含最近 12 个月搜索。
- 候选来源至少覆盖 6 类 source cluster；不能超过 40% 候选来自同一来源簇。
- 至少 20% 候选是反方、失败、争议或外部视角材料。
- 每个候选都标注 `expected_payload`；无法预期有效载荷的候选只能保留为低优先级线索。
- 每个候选都标注 `expected_parse_artifacts` 和 `payload_validation_plan`；HTML/PDF/视频候选必须在搜索阶段就预判后续如何清洗、抽取、OCR、下载字幕或识别 shell 风险。

这些不是“整个项目的质量门槛”，而是单轮发现是否足够结构化的检查。若不满足，必须先补本轮搜索矩阵，再进入 Step 2。

## 0.2 Step 2：过滤垃圾来源并追溯 canonical 原始来源

Step 2 的目标是把候选来源变成“可下载/可导出的准入队列”。这一步只判断：是否值得进入 raw 归档、应追溯到哪个 canonical 来源、属于哪个来源簇、是否可能有效。

### 0.2.1 输入

- `discovery/search-plan.md`
- `discovery/candidate-sources.jsonl`
- 3.2 的硬拒绝、降权和 payload 规则
- 3.1.1 的来源簇折算规则

### 0.2.2 追溯流程

每个候选必须按以下顺序处理：

```text
候选链接
→ 判断是否垃圾/聚合/搬运/空壳风险
→ 找作者、发布日期、发布机构
→ 找原始发布页、官方 transcript、原视频、PDF、监管文件或本人账号
→ 判断 canonical source
→ 判断 source_cluster_id 和是否独立
→ 预估 payload_status
→ 写入 acquisition queue
```

### 0.2.3 Step 2 输出

Step 2 输出 `discovery/acquisition-queue.jsonl`、`discovery/rejected-candidates.jsonl` 和 `evidence/source-quality.md` 的初版。

`acquisition-queue.jsonl` 每行必须包含：

```json
{
  "queue_id": "queue_0001",
  "candidate_id": "cand_0001",
  "canonical_url": "https://official.example.com/interview-transcript",
  "canonical_source_id_hint": "src_long_interview_2019",
  "source_tier": "P2",
  "source_cluster_id": "cluster_long_interviews",
  "canonical_work_id": "interview_2019_official",
  "counts_as_independent_source": true,
  "independence_reason": "Different interviewer and live Q&A setting from written essays.",
  "expected_payload_status": "valid",
  "expected_payload_type": "full_transcript",
  "download_method": "dokobot read / curl / yt-dlp / manual export",
  "allowed_uses": ["mental_model", "expression", "interaction_patterns"],
  "research_dimensions": ["long_conversations", "interaction_patterns"],
  "admission_decision": "queue_for_raw_archive",
  "admission_reason": "Official transcript with full Q&A."
}
```

`rejected-candidates.jsonl` 每行必须说明拒绝原因：

```json
{
  "candidate_id": "cand_0027",
  "url": "https://example.com/top-100-quotes",
  "rejection_reason": "quote aggregator without context or canonical links",
  "can_be_used_for_discovery": false
}
```

### 0.2.4 Step 2 轮次完成条件

单轮 Step 2 进入 Step 3 前必须满足：

- 每个 queued source 都有 `source_cluster_id`、`canonical_work_id`、`counts_as_independent_source` 和 `expected_payload_status`。
- 每个 queued source 都有明确下载方法：`curl`、`dokobot read`、浏览器导出、手工导出、字幕下载、OCR 或付费库。
- 每个 queued source 都有明确解析产物计划：HTML 必须说明是否生成 clean text；PDF 必须说明是否运行 `pdftotext`、OCR 或截图索引；视频必须说明字幕/转写产物。
- 本轮新增 source cluster、重复 cluster、rejected cluster 都必须分别统计。
- 所有 P4/P5 二手材料必须写明是否能追溯到 P1-P3；不能追溯的只允许进入外部视角或未验证线索。
- 所有可能是页面壳的候选必须在 Step 2 标记为 `expected_payload_status=shell_risk`，Step 3 下载后必须优先验证。
- 所有 PDF 候选必须在 Step 2 标记 `expected_parse_artifacts`，至少包含 `raw_pdf` 和 `text_extract`；如果预计是扫描件，必须标记 `ocr_required`。没有文本抽取计划的 PDF 只能排入 `discovery_only` 或低优先级队列。
- 所有 HTML 候选必须在 Step 2 标记 `html_body_risk` 或 `clean_text_required`，并说明预期正文位置：文章正文、问答正文、transcript 区、公告正文、表格正文或附件链接。无法预期正文位置的 HTML 只能作为 `shell_risk`。
- 视频候选必须写明上传者类型、视频完整性、字幕可得性和预计字幕来源。上传者类型包括 `official_channel`、`institution_channel`、`publisher_channel`、`conference_channel`、`third_party_archive`、`clip_channel`、`unknown`。

如果 Step 2 发现候选高度集中在单一来源簇，本轮可以下载高价值来源，但 Step 3.5 必须把集中风险写成下一轮 Step 1 的搜索目标。

## 1. 设计目标

persona 不是语气模仿，也不是语录拼贴。一个合格的 persona 应该同时捕捉：

- 此人如何获取信息
- 此人如何判断问题
- 此人如何表达不确定性
- 此人如何在压力、争议、失败中反应
- 此人有哪些稳定价值观、反模式和盲区
- 此 persona 在哪些问题上不应冒充知道

最终产物必须支持三件事：

1. **可运行**：给 agent 使用后，能稳定触发、路由问题、调用研究流程并输出一致风格。
2. **可审计**：每个核心判断都能回溯到来源、证据和推断过程。
3. **可更新**：活人、公司、主题可以增量补充新材料，而不是每次重写。

## 2. 产物结构

推荐目录：

```text
persona-name-perspective/
├── SKILL.md
├── persona.json
├── scripts/
│   ├── download_subtitles.sh
│   ├── srt_to_transcript.py
│   ├── merge_research.py
│   └── quality_check.py
├── discovery/
│   ├── search-plan.md
│   ├── candidate-sources.jsonl
│   ├── acquisition-queue.jsonl
│   └── rejected-candidates.jsonl
├── corpus/
│   ├── sources.jsonl
│   ├── excerpts.jsonl
│   ├── coverage-matrix.md
│   └── raw/
│       ├── writings/
│       ├── transcripts/
│       ├── audio/
│       ├── social/
│       ├── decisions/
│       └── external/
├── evidence/
│   ├── mental-models.jsonl
│   ├── heuristics.jsonl
│   ├── expression-dna.json
│   ├── contradictions.md
│   ├── limits.md
│   └── source-quality.md
├── research/
│   ├── 01-systematic-writings.md
│   ├── 02-long-conversations.md
│   ├── 03-short-expression.md
│   ├── 04-decisions-actions.md
│   ├── 05-failures-controversies.md
│   ├── 06-external-views.md
│   ├── 07-timeline-evolution.md
│   ├── 08-domain-context.md
│   └── 09-interaction-patterns.md
└── tests/
    ├── known-stance-tests.md
    ├── edge-case-tests.md
    ├── voice-tests.md
    └── regression-prompts.md
```

`SKILL.md` 是运行时文件；其他文件是证据、调研和维护资产。任何可分发 persona 都应该保留这些文件，不能只交付 `SKILL.md`。

`corpus/raw/` 是最先产生、最重要的目录。`sources.jsonl` 中可用于证据的条目必须能回指到这里。没有本地归档的来源，只能作为 `discovery_only`，不得用于摘录、模型或运行时 persona。

### 2.1 入口文件不是完整人格

`SKILL.md` 只是 Codex skill loader 能识别的入口文件，不是完整 persona。只安装或交付一个 `SKILL.md`，本质上仍然是“通用模型 + 风格提示词”，最多只能标记为 `style-guide` 或 `prompt-only-draft`。

完整 persona 必须是一个运行包：

- `SKILL.md`：触发条件、边界、运行流程和文件读取顺序。
- `persona.json`：机器可读的路由表、核心模型、启发式、证据 ID、置信度、失败模式和版本状态。
- `corpus/`：来源账本、摘录账本和本地 raw payload。
- `research/` 与 `evidence/`：从摘录到心智模型的推断链。
- `tests/`：已知立场、声音、边界和回归用例。

如果运行环境不会读取同目录的 `persona.json`、`corpus/`、`evidence/` 和 `tests/`，则不得宣称这是完整 persona，只能宣称这是一个基于研究材料压缩出来的 skill prompt。

### 2.2 轻量运行包

如果完整 RAG / 证据图谱太重，可以交付轻量运行包，但必须明示状态为 `lightweight-case-card-runtime`，不能宣称等同完整 persona。

轻量运行包的最小结构：

```text
persona-name-perspective/
├── SKILL.md
├── persona.json
├── cases.jsonl
└── evals.md
```

轻量模式的职责划分：

- `SKILL.md`：只做入口、触发、边界和读取顺序。
- `persona.json`：保留 5-7 个核心模型、5-12 条启发式、路由和诚实边界。
- `cases.jsonl`：保留 20-40 个案例卡，每张卡必须有 `case_id`、`tags`、`linked_models`、`lesson`、`use_when` 和 `avoid_when`。
- `evals.md`：至少 20 个回归问题，覆盖已知立场、案例匹配、越界拒绝和声音。

轻量模式的回答流程：

```text
问题分类
→ 选择 1-2 个 core_models
→ 匹配 0-2 个 case cards
→ 检查边界和不确定性
→ 输出表达风格
```

轻量模式不要求每次回答回查完整 `corpus/`，但核心模型和案例卡必须来自已归档证据或人工审定材料。否则它仍然只是 prompt-only draft。

辅助脚本的用途和调用方式详见 [persona-scripts.md](/Users/ttu/projects/persona-router/docs/persona-scripts.md)。这些脚本基于 `nuwa-skill` 的工具层适配而来，生成可分发 persona 时可以复制进 persona 自身的 `scripts/` 目录。

Dokobot 搜索先行和归档准入规则详见 [dokobot-search-skill.md](/Users/ttu/projects/persona-router/docs/dokobot-search-skill.md)。数据采集阶段应先使用 `dokobot search` 发现候选来源，并在写入任何 `corpus/raw/src_*` 文件前完成有用性判断；只有通过准入的来源才允许读取、下载或转写到 raw corpus。如果在 Codex 沙箱中运行 Dokobot CLI，必须按该指南使用非沙箱权限。

## 3. 数据采集标准

### 3.1 来源分层

| 层级 | 类型 | 权重 | 说明 |
|---|---|---:|---|
| P0 | 用户提供的一手材料 | 最高 | 私有访谈、邮件、文档、聊天记录、会议纪要、录音转写 |
| P1 | 本人直接产出 | 最高 | 书、文章、演讲、访谈、播客、视频、社交账号、代码、产品发布 |
| P2 | 直接互动记录 | 高 | AMA、评论回复、邮件往来、庭审/会议记录、公开问答 |
| P3 | 行动与决策记录 | 高 | 公司决策、产品取舍、投资、招聘、辞职、转向、道歉 |
| P4 | 可信二手材料 | 中 | 传记、深度报道、同行评价、书评、纪录片 |
| P5 | 批评与反方材料 | 中 | 公开批评、争议复盘、失败分析、反对者文章 |
| P6 | 聚合资料 | 低 | 百科、语录站、摘要站、搜索结果片段 |

默认禁止把 P6 作为核心证据。P6 只能用于发现线索，必须追溯到 P1-P5。

### 3.1.1 来源、材料、证据的计数单位

必须区分三个计数：

| 计数 | 含义 | 可用于什么 |
|---|---|---|
| `raw_item_count` | 本地保存的文件或记录数量，例如 48 封年度信、120 条微博、1 个视频页 | 说明归档规模 |
| `canonical_work_count` | 可独立引用的作品、访谈、会议、书、文章、决策文件数量 | 判断材料覆盖 |
| `independent_source_count` | 彼此独立的来源簇数量，按作者/场景/媒介/时间/动机去重后计算 | 判断覆盖广度和最终交付状态 |

示例：

- 一个企业家 1977-2024 年的年度致股东信可以是 48 个 `raw_item`、48 个 `canonical_work`，但如果全部来自同一作者、同一场景、同一制度化格式，只能算作 1 个 `independent_source_cluster`，不能单独满足 A 档“50 个来源”。
- 同一播客的 10 期深访可以是 10 个 `canonical_work`，但通常只算 1 个节目来源簇；如果其中包含不同主持人、不同场景、不同争议回应，可在 `source-quality.md` 中说明拆分理由。
- 一本书的每章不能算多个来源；一整本书通常是 1 个 `canonical_work` 和 1 个来源簇。
- 一个新闻页面如果只包含视频卡片、播放器配置或摘要介绍，而没有 transcript 或实质正文，只能是 `discovery_only`，不能算 `canonical_work`。

`sources.jsonl` 必须记录来源簇：

```json
{
  "source_id": "src_0042",
  "source_cluster_id": "cluster_shareholder_letters",
  "canonical_work_id": "berkshire_letter_2001",
  "counts_as_independent_source": false,
  "independence_reason": "Part of the same annual shareholder-letter series; useful raw item, not a separate independent source."
}
```

交付地板中的“来源”默认指 `counts_as_independent_source=true` 的数量，而不是文件数。`raw_item_count` 可以帮助提高摘录量和时间覆盖，但不能替代多场景、多媒介、多动机的来源独立性。

### 3.2 来源准入与垃圾过滤

垃圾来源不能只是“低权重”，很多来源应该在采集阶段直接丢弃。否则后续摘录、聚类和心智模型提炼都会被污染。

#### 3.2.1 硬拒绝来源

以下来源默认不得进入 `excerpts.jsonl`，也不得支撑任何模型：

| 类别 | 例子 | 处理 |
|---|---|---|
| 不可验证聚合页 | 百度百科、百度知道、无引用 wiki 镜像、语录站 | 只可用于发现线索，不可入证据 |
| 洗稿/搬运生态 | 知乎搬运答案、微信公众号二手转述、百家号、搜狐号、头条号、网易号搬运文 | 默认拒绝 |
| SEO 内容农场 | 大量广告、模板化小标题、无作者、无原始引用的“人物成功学”文章 | 拒绝 |
| AI 生成/疑似 AI 生成 | 大量通用形容词、无原始出处、事实密度低、结构模板化 | 拒绝或标记为污染样本 |
| 语录拼贴 | “某某 100 句金句”、无上下文 quote list | 只可追溯原文，不可直接使用 |
| 无时间戳短视频搬运 | 剪辑号、解说号、二创摘要 | 拒绝，除非能找到原始视频 |
| 匿名爆料 | 无可验证身份、无交叉证据 | 不作为 persona 证据 |
| 搜索结果摘要 | SERP snippet、AI 搜索摘要 | 不入证据 |

例外规则：如果硬拒绝来源包含指向原始来源的明确链接，可以把它作为 `discovery_only` 记录到 `sources.jsonl`，但 `admission_status` 必须是 `rejected` 或 `discovery_only`。

#### 3.2.2 中文来源准入

中文人物或中文主题优先级：

1. 本人出版物、本人博客、本人微博/即刻/小红书/视频号等可验证账号。
2. 原始长视频、演讲、直播回放、播客原始音频：B 站官方号、小宇宙、喜马拉雅原始节目、YouTube 官方频道。
3. 权威或一线采访：晚点 LatePost、财新、第一财经、36 氪、极客公园、虎嗅、少数派、机器之心、澎湃、界面等。
4. 公司官方材料：公告、访谈、发布会、招聘文档、产品文档、投资人信。
5. 可信二手分析：有作者、有引用链、有反方材料、有事实核查的深度文章。

中文人物默认排除：知乎、微信公众号、百度百科、百度知道、营销号矩阵和所有无法追溯原始出处的“整理文”。

#### 3.2.3 英文来源准入

英文人物或英文主题优先级：

1. 本人网站、书、论文、代码仓库、newsletter、官方博客。
2. 原始播客、访谈、演讲、会议视频、庭审/听证/会议 transcript。
3. 权威长文与深度报道：有作者、编辑机构、引用链和发布日期。
4. 同行评价、书评、批评文章、历史档案。
5. 社交媒体原始账号。

英文来源默认排除：quote aggregators、SEO biography pages、AI summary pages、celebrity net worth pages、无作者的 listicle、未标注来源的 Medium/Substack 摘要。

#### 3.2.4 降权来源

以下来源可以保留，但不得单独支撑核心模型：

- 二手传记中未经原文验证的转述
- 新闻短讯
- 论坛讨论
- Reddit/HN 评论
- 书评和播客笔记
- 第三方 transcript
- 自动字幕
- 社交媒体截图

降权来源必须满足至少一项：

- 与 P0-P3 来源交叉验证
- 用于外部视角、争议、传播影响，而不是证明本人真实信念
- 明确标记为 `reported`、`external_view` 或 `low_confidence`

#### 3.2.4.1 视频、音频和字幕来源

公开视频是 persona 采集中必须单独处理的一等来源，尤其适用于演讲、长访谈、课堂问答、听证、年度会议、播客和直播回放。不得只保存 YouTube/Bilibili 落地页 HTML 后声称已采集音视频材料；真正可用的 raw payload 是字幕、官方 transcript、人工转写、音频文件或视频文件本身。

Step 1 搜索必须包含视频字幕专项 query，例如：

```text
"{name}" YouTube full interview
"{name}" lecture Q&A subtitles
"{name}" annual meeting transcript video
"{name}" testimony video captions
site:youtube.com "{name}" "full interview"
site:youtube.com "{name}" "Q&A"
```

Step 2 视频候选字段建议增加：

```json
{
  "media_source_type": "youtube_video",
  "uploader_type": "institution_channel",
  "video_completeness": "full_event",
  "estimated_duration_minutes": 87,
  "subtitle_status_expected": "manual_or_auto_available",
  "subtitle_language_expected": ["en"],
  "transcript_download_method": "yt-dlp --write-subs --write-auto-subs --skip-download",
  "video_risk_flags": ["third_party_upload", "speaker_diarization_needed"]
}
```

视频候选准入规则：

- 优先：本人/公司/学校/媒体/会议/政府机构官方频道发布的完整视频，或原始发布方提供的 transcript。
- 可用但降权：可信第三方档案上传、自动字幕、无说话人分离但内容完整的视频。
- 默认拒绝：短 highlight、剪辑号、反应视频、解说二创、无上下文片段、标题党成功学剪辑。
- 如果只有视频页 HTML，没有字幕、transcript、音频或视频文件，不得标记为 `accepted` 或 `limited`，只能是 `discovery_only`。

Step 3 视频采集优先顺序：

```bash
yt-dlp --write-subs --write-auto-subs --sub-langs "en.*,zh.*" --skip-download -o "corpus/raw/transcripts/src_video_%(id)s.%(ext)s" "<url>"
```

如果字幕不可用，但视频高度关键，可以下载音频并标记为 `needs_transcription`：

```bash
yt-dlp -f bestaudio --extract-audio --audio-format mp3 -o "corpus/raw/audio/src_video_%(id)s.%(ext)s" "<url>"
```

字幕 raw 文件必须保存 `.vtt`、`.srt` 或平台原始字幕格式；同时生成 normalized transcript `.txt`，但不得用 `.txt` 替代原始字幕文件。自动字幕必须在 `sources.jsonl` 标记：

```json
{
  "payload_type": "auto_subtitle_transcript",
  "transcript_kind": "auto_caption",
  "subtitle_language": "en",
  "duration_seconds": 5220,
  "speaker_diarization": "unknown",
  "transcript_confidence": "medium",
  "payload_validation_notes": "Auto captions downloaded via yt-dlp; spot-check required before direct quotation."
}
```

字幕 payload 验证：

- A/B 档长访谈或演讲默认要求有效转写不少于 5 分钟或 500 词。
- 自动字幕必须抽样检查至少 3 个时间点：开头、中段、结尾。
- 多人对话如无法分辨说话人，仍可用于主题、互动和表达研究，但 direct quote 必须人工核对。
- 第三方上传视频必须尽量追溯官方版本；追溯失败时只能 `limited`，并写明上传者和不确定性。
- 视频时长、字幕词数、字幕类型、字幕语言、上传者类型必须进入 `source-quality.md` 或 `coverage-matrix.md` 统计。

#### 3.2.5 原始文件有效载荷验证

任何写入 `accepted` 或 `limited` 的来源，都必须先通过 raw payload 验证。验证结果写入 `sources.jsonl` 和 `evidence/source-quality.md`。

最低有效载荷标准：

| 类型 | 可接受 payload | 不可接受 payload |
|---|---|---|
| HTML 文章/页面 | 正文、问答、完整转写、表格、公告原文、可定位段落；必须生成或保存 clean text，并通过正文段落抽样 | 只有标题、摘要、播放器、视频卡片、广告、脚本、JSON 配置、附件链接；清洗后只剩导航/模板/登录墙/访问拦截 |
| PDF | PDF 本身以及可读文本抽取；扫描件需 OCR 或截图索引；必须保存 text/OCR 产物路径 | 下载失败页、空白 PDF、只有封面/目录、PDF 链接页被误存为 PDF；只保存二进制但没有可摘录文本 |
| 音视频 | 原始音视频文件、官方 transcript、`.vtt`/`.srt` 字幕、自动字幕、人工转写；同时保留原视频 URL | 只有视频落地页、只有 highlight 标题、无 transcript 的播放器页 |
| 社交媒体 | 可验证账号导出、完整帖文、时间戳、回复上下文 | 截图拼贴、二手整理、无上下文 quote |
| 决策材料 | 公告、会议记录、合同摘要、公开信、监管文件、产品变更记录 | 新闻标题、短讯、没有原始文件的评论 |

必须记录的 payload 字段：

```json
{
  "payload_status": "valid",
  "payload_type": "full_text",
  "payload_word_count": 8421,
  "payload_extractable": true,
  "parse_artifacts": {
    "raw_path": "corpus/raw/writings/src_0001.html",
    "text_path": "corpus/raw/writings/src_0001.html.clean.txt",
    "clean_text_generated": true,
    "pdf_text_extracted": false,
    "ocr_applied": false
  },
  "noise_checks": {
    "html_tag_residue": false,
    "navigation_or_template_dominant": false,
    "table_or_number_dominant": false,
    "access_block_detected": false
  },
  "payload_validation_notes": "HTML contains the full body; converted to text for excerpting."
}
```

`payload_status` 取值：

- `valid`：可摘录正文足够支撑用途
- `partial`：只有部分正文或转写，只能 `limited`
- `shell`：只有壳页、索引、播放器或附件链接，只能 `discovery_only`
- `failed`：下载失败、解析失败、内容为空或明显错误，只能 `rejected`

硬性规则：

- `payload_status` 为 `shell` 或 `failed` 的来源不得进入 `excerpts.jsonl`。
- HTML 中清洗后正文可读词数少于 500，或 transcript 有效问答少于 5 分钟，默认不得作为 A/B 档有效来源；除非是高价值短声明、道歉、辞职信、判决、公告等决策材料，并在 `admission_reason` 解释。
- HTML 原始文件必须生成 clean text 或保存等价正文抽取结果；如果 clean text 中仍有大量 HTML 标签残留、导航链接、广告文案、模板页脚、播放器卡片、登录墙、访问拦截或脚本配置，`payload_status` 必须降为 `shell` / `failed`，不能只按词数标记 `valid`。
- PDF 原始文件必须生成可摘录文本：`pdftotext`、OCR 或人工转写/截图索引三者之一。PDF 二进制存在但没有 text/OCR 产物时，不得进入 `accepted` / `limited`；只能标记 `shell`、`failed` 或 `needs_ocr`，并写入下一轮补救目标。
- PDF 文本抽取后必须抽样检查：如果抽取结果主要是乱码、页眉页脚、目录、表格碎片、下载错误页或访问拦截文案，不能按文件大小或词数标记 `valid`。
- 如果页面内真正有用的是 PDF、字幕、视频或附件，必须下载附件本身；保存外层 HTML 不算完成归档。
- 如果来源是 YouTube/Bilibili/播客/视频平台，必须优先保存字幕或音频转写；只有平台 HTML 的 `raw_path` 必须标记为 `shell` 或 `discovery_only`。
- Step 3 每轮结束前必须抽样打开至少 6 个归档产物：早期、中期、近期各 1 个 raw；HTML clean text 至少 1 个；PDF text/OCR 至少 1 个；视频字幕/transcript 至少 1 个。确认内容不是模板、乱码、导航壳、表格碎片或空壳。

#### 3.2.6 来源入库字段

`sources.jsonl` 必须增加以下字段：

```json
{
  "admission_status": "accepted",
  "admission_reason": "Self-authored essay on official personal site.",
  "source_cluster_id": "cluster_official_essays",
  "canonical_work_id": "how_to_do_great_work",
  "counts_as_independent_source": true,
  "independence_reason": "Standalone essay, not part of a repetitive series used to inflate source count.",
  "payload_status": "valid",
  "payload_type": "full_text",
  "payload_word_count": 8230,
  "payload_extractable": true,
  "payload_validation_notes": "Full body archived locally and manually spot-checked.",
  "parse_artifacts": {
    "raw_path": "corpus/raw/writings/src_0001.html",
    "text_path": "corpus/raw/writings/src_0001.html.clean.txt",
    "clean_text_generated": true,
    "pdf_text_extracted": false,
    "ocr_applied": false
  },
  "noise_checks": {
    "html_tag_residue": false,
    "navigation_or_template_dominant": false,
    "table_or_number_dominant": false,
    "access_block_detected": false
  },
  "canonical_source_id": null,
  "is_original": true,
  "is_derivative": false,
  "derivative_of": null,
  "contains_primary_quotes": true,
  "has_verifiable_author": true,
  "has_publication_date": true,
  "garbage_signals": [],
  "allowed_uses": ["mental_model", "expression", "timeline"]
}
```

可用作证据的来源还必须满足：

- `accepted` 和 `limited` 条目必须填写 `raw_path`，且文件必须存在于 `corpus/raw/`。
- `raw_path` 应保存尽量接近 canonical 来源的原始内容，例如 `.html`、`.md`、`.txt`、`.pdf`、`.srt`、`.vtt`、`.json`、`.csv` 或转写文本。
- `raw_path` 指向的文件必须通过 payload 验证；如果本地文件只是索引、播放器壳或附件列表，`admission_status` 只能是 `discovery_only` 或 `rejected`。
- 如果来源是 HTML，`accepted` / `limited` 条目必须填写 `text_path` 或 `parse_artifacts.text_path`，指向 clean text；只把 `.html` 作为 `raw_path` 不够。
- 如果来源是 PDF，`accepted` / `limited` 条目必须填写 `text_path` 或 `parse_artifacts.text_path`，指向 `pdftotext`/OCR/人工转写结果；只有 `.pdf` 没有可读文本不够。
- `noise_checks` 中只要 `html_tag_residue`、`navigation_or_template_dominant`、`table_or_number_dominant`、`access_block_detected` 任一为 true，必须在 `payload_validation_notes` 解释为什么仍可用；无法解释则降为 `discovery_only` / `rejected`。
- 只记录 URL 但没有本地归档的条目，`admission_status` 只能是 `discovery_only`，`allowed_uses` 只能包含 `discovery`。
- 如果因版权、登录、技术限制不能完整保存原文，必须保存可审计的最小复查材料，例如标题、作者、日期、canonical URL、访问时间、摘录位置、截图或 transcript 片段，并在 `source-quality.md` 标明限制。

`admission_status` 取值：

- `accepted`：可进入证据链
- `limited`：只能用于指定用途
- `discovery_only`：只能用于发现原始来源
- `rejected`：不得使用

`allowed_uses` 取值包括：

- `mental_model`
- `heuristic`
- `expression`
- `timeline`
- `external_view`
- `controversy`
- `discovery`

#### 3.2.7 引用链追溯

任何二手来源中的关键说法必须追溯：

```text
二手文章 → 引用原始采访 → 找到 transcript/video → 截取原文 → 入 excerpts
```

如果追溯失败：

- 不得作为 `direct` 证据
- 不得支撑心智模型
- 只能写入 `source-quality.md` 的“未验证线索”

#### 3.2.8 去重、系列折算和污染检测

采集后必须执行去重：

- 同一篇文章的转载只保留 canonical URL。
- 同一个 transcript 的不同搬运版本只保留最接近原始发布方的版本。
- 同一段话被多个语录站重复引用，只算 1 条证据。
- 同一新闻通稿被多家媒体转载，只算 1 个来源。
- 同一作者在同一固定栏目、年度系列或节目系列中的材料必须归入同一个 `source_cluster_id`；可以作为多个 raw item 和 excerpt 来源，但不能全部计入 `independent_source_count`。
- 同一场会议的完整视频、上午视频、下午视频、highlight、新闻稿、会议页面只能形成 1 个事件簇；除非存在真正不同的原始记录，例如完整 transcript、现场问答记录、董事会决议和独立采访。
- 同一书籍的精装版、电子版、有声书、摘录页和出版社宣传页只算 1 个 canonical work；宣传页若无正文只能 `discovery_only`。
- 同一事实被 20 家媒体报道不等于 20 个来源；原始公告、原始采访、深度二手分析、批评复盘可以分别计数，通稿转载不能计数。

污染信号：

- 标题党、夸张成功学措辞
- 无作者、无日期、无原始链接
- 大量“众所周知”“有人说”“据传”
- 引用无法在原始材料中找到
- 内容只总结结论，不给上下文
- 与多个垃圾站文本高度相似

污染来源写入 `evidence/source-quality.md`，并说明丢弃原因。

### 3.3 全面采集目标和交付状态

按照对象公开材料丰富度分三档。下表不是“达到即可停止”的门槛，而是判断最终交付状态的最低地板。采集阶段必须继续按 0.0 的多轮循环尽可能扩大资料覆盖。

| 档位 | 适用对象 | 完整 persona 交付地板 | 全面采集目标 |
|---|---|---:|---:|
| A 丰富公开材料 | 名公众人物、企业家、作者、创作者 | 50 个独立来源 / 1000 条摘录 | 尽可能接近互联网可得全集；通常 150+ 来源 / 3000+ 摘录 |
| B 中等公开材料 | 行业人物、小众创作者、公司高管 | 20 个独立来源 / 400 条摘录 | 尽可能接近公开可得全集；通常 60+ 来源 / 1000+ 摘录 |
| C 私有人物/冷门对象 | 用户自己、同事、非公众人物 | 10 个独立来源 / 200 条摘录 | 尽可能覆盖用户提供材料和少量公开材料；通常 30+ 来源 / 600+ 摘录 |

这里的“来源”指 `independent_source_count`，不是 `raw_item_count`。年度信、同一节目多期、同一会议多段视频、同一书籍多格式、同一博客连续文章可以贡献大量摘录和时间覆盖，但必须先按 `source_cluster_id` 折算。

如果低于完整 persona 交付地板，不得生成“完整 persona”，只能生成 `draft`、`style guide` 或 `domain framework`。如果已经高于交付地板，也不得因此停止采集；必须继续执行规定轮次，直到 0.0.2 的停止条件成立。

推荐的独立来源簇配比：

| 档位 | 最低独立来源簇 | 单一来源簇摘录占比上限 | 最低媒介/场景种类 |
|---|---:|---:|---:|
| A | 50 | 25% | 6 类 |
| B | 20 | 35% | 4 类 |
| C | 10 | 50% | 3 类 |

媒介/场景种类包括：本人长文/书、长访谈 transcript、短表达/社交、公开演讲、真实决策材料、失败/争议材料、可信二手传记/深度报道、同行/批评者评价、互动问答、领域背景材料。

低于完整 persona 交付地板时，不得生成“完整 persona”。只能生成 `draft`，并在 `SKILL.md` 的诚实边界中明确标记。

### 3.4 数据种类配比

| 数据种类 | 目的 | A 档最低要求 | B/C 档最低要求 |
|---|---|---:|---:|
| 系统性长文本 | 稳定思想框架 | 20 篇或 1 本书 | 5 篇或等价长文 |
| 长对话/访谈 | 即兴推理、被追问反应 | 5 小时 transcript | 1 小时 transcript |
| 视频/音频字幕 | 现场表达、停顿、被追问反应、非编辑语言 | 10 小时字幕/转写，含至少 5 个 source cluster | 2 小时字幕/转写 |
| 短表达/社交 | 语言指纹、即时判断 | 300 条 | 50 条 |
| 真实决策 | 言行一致性 | 10 个案例 | 3 个案例 |
| 失败/争议/反转 | 防止英雄叙事 | 5 个案例 | 2 个案例 |
| 外部评价 | 盲点和反方视角 | 10 个来源 | 3 个来源 |
| 时间线 | 观念演化 | 全生命周期 | 关键阶段 |
| 同行/领域背景 | 区分个性与行业共识 | 5 个对照对象 | 2 个对照对象 |
| 互动模式 | 对不同对象的说话方式 | 50 段互动 | 10 段互动 |

如果某类数据缺失，必须在 `coverage-matrix.md` 和 `limits.md` 中标注，不得用其他类别强行补齐。

## 4. Corpus 账本

### 4.1 `sources.jsonl`

每条来源一行 JSON：

```json
{
  "source_id": "src_0001",
  "title": "How to Do Great Work",
  "author": "Paul Graham",
  "url": "https://paulgraham.com/greatwork.html",
  "date_published": "2023-07-01",
  "date_accessed": "2026-05-03",
  "source_tier": "P1",
  "source_type": "essay",
  "medium": "text",
  "language": "en",
  "time_period": "late-career",
  "topics": ["work", "curiosity", "ambition"],
  "reliability": 0.95,
  "bias_notes": "Self-authored essay; polished public stance.",
  "admission_status": "accepted",
  "admission_reason": "Self-authored essay on official personal site.",
  "source_cluster_id": "cluster_paulgraham_essays",
  "canonical_work_id": "how_to_do_great_work",
  "counts_as_independent_source": true,
  "independence_reason": "Standalone essay with full body, not a duplicate or shell page.",
  "payload_status": "valid",
  "payload_type": "full_text",
  "payload_word_count": 8072,
  "payload_extractable": true,
  "payload_validation_notes": "Manual spot-check confirms full article body is present.",
  "canonical_source_id": null,
  "is_original": true,
  "is_derivative": false,
  "derivative_of": null,
  "contains_primary_quotes": true,
  "has_verifiable_author": true,
  "has_publication_date": true,
  "garbage_signals": [],
  "allowed_uses": ["mental_model", "expression", "timeline"],
  "raw_path": "corpus/raw/writings/src_0001.md"
}
```

必填字段：

- `source_id`
- `title`
- `url`
- `raw_path`（`accepted` / `limited` 必填；`discovery_only` 可为空）
- `date_accessed`
- `source_tier`
- `source_type`
- `medium`
- `language`
- `reliability`
- `admission_status`
- `admission_reason`
- `source_cluster_id`
- `canonical_work_id`
- `counts_as_independent_source`
- `independence_reason`
- `payload_status`
- `payload_type`
- `payload_word_count`
- `payload_extractable`
- `payload_validation_notes`
- `is_original`
- `is_derivative`
- `garbage_signals`
- `allowed_uses`

### 4.2 `excerpts.jsonl`

每条摘录一行 JSON：

```json
{
  "excerpt_id": "ex_0123",
  "source_id": "src_0001",
  "quote": "Writing doesn't just communicate ideas; it generates them.",
  "paraphrase": "他认为写作本身会生成思想，而不是只表达已有思想。",
  "location": "section 2",
  "evidence_tags": ["mental_model", "expression"],
  "candidate_claim": "Writing is thinking.",
  "confidence": 0.92,
  "inference_level": "direct",
  "notes": "Direct claim; repeated in multiple essays."
}
```

摘录规则：

- `excerpts.jsonl` 只能从本地 `raw_path` 指向的材料中摘录。
- 摘录时必须记录可回查位置：页码、章节、时间戳、段落、行号或截图编号。
- 不得从搜索结果摘要、新闻聚合摘要、AI 总结、未落盘网页阅读结果中直接摘录。
- 如果摘录来自转写材料，必须保留原始音视频 URL 和本地 transcript 路径。
- 每条摘录必须来自 `payload_status` 为 `valid` 或 `partial` 的来源；`shell`、`failed`、`discovery_only` 和 `rejected` 来源不得出现在 `source_id` 中。
- 摘录不能只靠关键词自动抽取。每个核心 claim 至少要有人审抽样，确认原文上下文没有反向含义、讽刺、引用他人观点或剪辑误导。
- 单一 `source_cluster_id` 的摘录不得超过总摘录的上限：A 档 25%，B 档 35%，C 档 50%。超出部分可以保留为 raw 语料，但不能用于计算 evidence 覆盖。
- 每个 `candidate_claim` 必须至少跨 2 个 `source_cluster_id` 才能进入心智模型候选；否则只能进入“单一来源观察”或 research 的低置信部分。

`inference_level` 取值：

- `direct`：本人直接表达
- `reported`：可信二手转述
- `behavioral`：从行动推断
- `synthetic`：跨多个来源归纳
- `speculative`：弱推断，只能进入边界或假设区

## 5. 调研维度

`research/*.md` 是从摘录到账本模型之间的研究层，不是摘要层。每个 research 文件必须包含以下结构：

```text
# 维度标题

## Scope
本文件回答什么问题，不回答什么问题。

## Evidence Table
| Claim | Excerpt IDs | Source clusters | Inference | Confidence | Notes |

## Pattern Analysis
跨来源复现的模式、条件、变化和边界。

## Counterevidence / Tensions
相反证据、失败案例、时间变化、场景例外。

## Open Gaps
缺少哪些原始材料，哪些结论只能暂时低置信。

## Implications for Runtime
哪些内容进入 SKILL、哪些只能进入边界或测试。
```

最低研究密度：

- A 档每个 research 文件至少 8 个实质 claim、30 条 excerpt 引用、5 个 source cluster；失败/争议和外部视角不得低于 3 个 source cluster。
- B 档每个 research 文件至少 5 个实质 claim、15 条 excerpt 引用、3 个 source cluster。
- C 档每个 research 文件至少 3 个实质 claim、8 条 excerpt 引用、2 个 source cluster。
- `Pattern Analysis` 必须解释“为什么这些证据支持该 claim”，不能只复述摘录。
- `Counterevidence / Tensions` 不能为空；如果找不到反证，必须写明搜索过哪些来源类型以及为什么仍缺失。
- `Open Gaps` 不能为空；完整 persona 也必须列出剩余盲区。

禁止的 research 形态：

- 每个文件只有 1-3 段泛泛总结。
- 只列 URL，不列 excerpt IDs。
- 每个维度复用同一批来源样例，没有针对该维度的证据。
- 把 `sources.jsonl` 的数量当作研究结论。
- 把 AI 总结、搜索结果、视频标题或页面 metadata 当作证据。

### 5.1 系统性表达

研究问题：

- 此人反复表达的核心主张是什么？
- 哪些概念是自创、内化或高频使用？
- 哪些观点跨多个领域重复出现？
- 哪些观点随时间发生变化？

输出到 `research/01-systematic-writings.md`。

### 5.2 长对话和即兴思考

研究问题：

- 被追问时如何改变、加强或回避观点？
- 遇到不知道的问题如何处理？
- 是否承认错误？如何承认？
- 类比、故事、反问、沉默、转移框架的模式是什么？

输出到 `research/02-long-conversations.md`。

### 5.3 短表达和语言指纹

研究问题：

- 高频词、句式、口头禅、禁用词是什么？
- 语气是断言型、探索型、讽刺型、教学型还是命令型？
- 社交媒体上比长文更激进还是更克制？
- 对支持者、批评者、陌生人是否使用不同语气？

输出到 `research/03-short-expression.md` 和 `evidence/expression-dna.json`。

### 5.4 决策和行动

研究问题：

- 重大决策前面对什么约束？
- 决策后是否复盘？是否改变路线？
- 此人说的原则和真实行为是否一致？
- 哪些选择体现了优先级排序？

输出到 `research/04-decisions-actions.md`。

### 5.5 失败、争议和反转

研究问题：

- 此人做错过什么？
- 面对失败时是归因于自己、系统、对手还是运气？
- 是否道歉、修正或加倍下注？
- 争议暴露了哪些盲区？

输出到 `research/05-failures-controversies.md`。

### 5.6 外部视角

研究问题：

- 同行如何评价此人的强项？
- 批评者认为此人最大的误区是什么？
- 崇拜者和批评者是否在同一点上达成一致？
- 外部视角是否纠正了自我叙事？

输出到 `research/06-external-views.md`。

### 5.7 时间线和阶段演化

研究问题：

- 人生/职业可分为几个阶段？
- 每个阶段的核心问题和表达方式是否不同？
- 近期 12 个月是否出现新变化？
- 活人 persona 的信息截止日期是什么？

输出到 `research/07-timeline-evolution.md`。

### 5.8 领域背景和同行对照

研究问题：

- 哪些观点只是行业常识？
- 哪些观点与同代人不同？
- 此人的方法在哪些领域成立，在哪些领域只是借用了名声？

输出到 `research/08-domain-context.md`。

### 5.9 互动模式

研究问题：

- 此人对学生、下属、同行、媒体、批评者、客户如何分别说话？
- 是启发式提问、直接判断、讲故事、给清单，还是重新定义问题？
- 是否存在高压、安抚、挑衅、幽默等固定互动手段？

输出到 `research/09-interaction-patterns.md`。

## 6. 提炼规则

### 6.1 心智模型

候选观点必须通过四重验证，才能进入核心心智模型：

1. **跨场景复现**：至少出现在 2 个不同主题或场景。
2. **证据多样性**：至少来自 2 类来源、3 个 `source_cluster_id`，例如长文 + 决策、访谈 + 行动。
3. **生成力**：能预测此人面对新问题时会优先看什么。
4. **排他性**：不是所有聪明人都会这么想。
5. **反证检查**：至少检查 2 条反例、失败或场景边界；没有反证检查的模型只能是候选模型。

来自同一系列材料的 30 条摘录不能替代跨来源验证。比如一组年度信只能证明“此人在股东信中如何表达”，不能单独证明其完整人格、互动模式或失败反应。

每个模型写入 `evidence/mental-models.jsonl`：

```json
{
  "model_id": "mm_001",
  "name": "Focus means saying no",
  "one_sentence": "聚焦不是选择一个好主意，而是拒绝许多好主意。",
  "evidence_excerpt_ids": ["ex_0012", "ex_0188", "ex_0440"],
  "source_diversity": ["keynote", "interview", "decision_case"],
  "counterevidence_excerpt_ids": ["ex_0522"],
  "applicable_contexts": ["product strategy", "resource allocation"],
  "failure_modes": ["May reject useful platform openness too early."],
  "confidence": 0.88
}
```

### 6.2 决策启发式

启发式是可运行规则，格式必须接近：

- 如果遇到 X，先看 Y。
- 当 A 和 B 冲突时，优先 B。
- 如果缺少 Z，就不要做判断。

每条启发式必须有至少 1 个行动案例或明确原话支持。

### 6.3 表达 DNA

表达 DNA 不允许只写“像某人一样犀利/温和”。必须量化：

- 平均句长
- 常见开头方式
- 段落长度
- 高频词
- 禁用词
- hedging 方式
- 反问频率
- 类比密度
- 幽默类型
- 对批评的回应模式
- 长文和短表达的差异

`expression-dna.json` 示例：

```json
{
  "sentence_length": {"average": "short", "notes": "Often 8-18 words."},
  "opening_patterns": ["direct claim", "personal anecdote", "question reframing"],
  "hedging": ["I think", "I suspect", "I may be wrong"],
  "forbidden_words": ["delve", "utilize", "synergy"],
  "analogy_density": "high",
  "humor": "dry, low frequency",
  "conflict_style": "brief rebuttal, often doubles down",
  "voice_risks": ["May become generic contrarian if overdone."]
}
```

### 6.4 矛盾和张力

矛盾不是错误，必须保留：

- 时间性矛盾：早期 A，后期 B
- 场景性矛盾：对自己 A，对他人 B
- 价值张力：自由 vs 纪律、开放 vs 控制
- 言行不一致：公开主张 A，行动显示 B

所有张力写入 `evidence/contradictions.md`，并在 `SKILL.md` 中至少保留 2 条。

## 7. Persona Runtime 规范

`SKILL.md` 必须包含以下部分：

1. frontmatter
2. 角色边界
3. 回答工作流
4. 问题路由表
5. 研究协议
6. 核心心智模型
7. 决策启发式
8. 表达 DNA
9. 互动模式
10. 时间线和阶段差异
11. 价值观、反模式、张力
12. 诚实边界
13. 来源摘要
14. 更新记录

### 7.0 第一人称运行时

persona 的默认运行形态应该是直接、自然的第一人称，而不是反复声明“用某某的视角”。生成 `SKILL.md` 时必须明确：

- 常规回答默认使用“我”来承载 persona 的判断、表达习惯和推理框架。
- 不要在每个回答开头写“用 X 的视角看”“作为一个 X 风格的模型”“X-derived perspective”等元叙述。
- 第一人称是运行时表达方式，不等于可以伪造身份、私人记忆、内部信息或未验证事实。
- 当用户问及身份、当前事实、私人想法、高风险建议或要求伪造原话时，必须切换到诚实边界：说明这是 persona 生成的回答，不能冒充真实本人。
- 对历史人物、公众人物或仍在世人物，允许 persona 用第一人称表达稳定原则和公开证据支持的判断；不得声称“我现在正在做某事”“我私下认为”“我持有/买入/卖出”这类需要当前或私人事实的内容。

推荐运行时措辞：

```text
我会先看这是不是我能理解的生意。
我不愿意为了一个看起来便宜的价格，买一个我无法判断长期经济性的东西。
如果这件事会伤害声誉，我不会用短期利润为它辩护。
```

不推荐运行时措辞：

```text
用巴菲特视角来看……
作为 Warren Buffett Perspective……
巴菲特可能会说……
我，Warren Buffett，现在认为……
```

### 7.1 回答工作流

每个 persona 必须有运行时 workflow：

```text
Step 1: 判断问题类型
Step 2: 判断是否需要实时研究
Step 3: 选择心智模型
Step 4: 检查边界和不确定性
Step 5: 用 persona 的表达 DNA 输出
Step 6: 对高风险或事实性问题附上不确定性说明
```

### 7.2 问题类型

至少支持：

- 事实型：必须查证，尤其是最新事件、市场、公司、人物状态。
- 判断型：先收集关键事实，再用模型判断。
- 纯框架型：可直接回答，但仍需标注推断边界。
- 角色互动型：按互动模式回应。
- 高风险型：医疗、法律、金融、人身安全等必须降级，不得用 persona 权威包装建议。
- 越界型：要求伪造本人当前观点、私人信息、内部行动、真实身份冒充或隐私推断时拒绝。单纯要求 persona 用第一人称表达，不视为越界。

### 7.3 运行时证据绑定

运行时不能只依赖 `SKILL.md` 中的自然语言总结。`SKILL.md` 必须把自己声明为入口，并要求 agent 在回答前按需读取同目录运行包：

```text
Step 0: 读取 persona.json 的 routing、core_models、heuristics、runtime_boundaries
Step 1: 对判断型/事实型问题选择 1-3 个 model_id 或 heuristic_id
Step 2: 用 evidence_excerpt_ids / counterevidence_excerpt_ids 回查 excerpts.jsonl
Step 3: 必要时读取对应 raw_path 或 research/*.md
Step 4: 如果证据不足、来源单一或超出截止日期，降级为框架回答或明确拒绝
Step 5: 最后再套用 expression-dna 输出
```

生成 `persona.json` 时，每个核心模型和启发式必须包含：

- 稳定 ID：`model_id` 或 `heuristic_id`
- 可触发场景：`applicable_contexts`
- 支撑证据：`evidence_excerpt_ids`
- 反证或张力：`counterevidence_excerpt_ids` 或 `failure_modes`
- 置信度：`confidence`
- 来源多样性：`source_diversity` 或可从 excerpt/source ledger 计算出的等价字段

如果这些字段缺失，模型只能作为文风提示，不能作为 persona 判断核心。

## 8. 质量检查和交付状态

### 8.1 Corpus 质量

| 检查项 | 通过标准 |
|---|---|
| 迭代充分性 | 已完成对应档位默认迭代轮次，或符合 0.0.2 的停止条件 |
| 来源总量 | `independent_source_count` 达到对应档位完整 persona 交付地板；`raw_item_count` 不得替代 |
| 来源独立性 | 每个来源簇有 `source_cluster_id`；同一系列、同一会议、同一书籍、同一通稿已折算 |
| 有效载荷 | `accepted` / `limited` 来源必须 `payload_status` 为 `valid` / `partial`，且可从 raw 中抽取正文 |
| 空壳过滤 | 播放器页、索引页、附件链接页、metadata 页不得作为有效来源 |
| 一手来源占比 | A/B 档不低于 50%，C 档不低于 70% 用户提供材料 |
| 数据种类覆盖 | 至少覆盖 7/9 个调研维度 |
| 反方材料 | 外部评价中批评或争议材料不少于 30% |
| 时间覆盖 | 覆盖早期、中期、近期；活人必须覆盖最近 12 个月 |
| 来源账本 | `sources.jsonl` 和 `excerpts.jsonl` 完整 |
| 垃圾过滤 | 所有 `rejected` / `discovery_only` 来源不得进入 `excerpts.jsonl` |
| 引用链 | 二手关键说法必须追溯到原始来源；追溯失败不得支撑心智模型 |
| 去重 | 转载、语录站重复引用、通稿转载只算 1 个 canonical 来源 |
| 摘录分布 | 单一来源簇摘录占比不超过对应档位上限 |

质量检查失败不代表停止采集；它决定当前产物只能以 `draft`、`limited` 或 `incomplete` 状态交付，并且必须把下一轮补源方向写入 `source-quality.md`。

### 8.1.1 Research 质量

| 检查项 | 通过标准 |
|---|---|
| 结构完整 | 每个 research 文件包含 Scope、Evidence Table、Pattern Analysis、Counterevidence / Tensions、Open Gaps、Runtime Implications |
| 证据密度 | 达到第 5 节对应档位的 claim、excerpt、source cluster 最低数量 |
| 证据可回溯 | 每个实质 claim 都列 excerpt IDs 和 source cluster |
| 反证存在 | 每个 research 文件都有反证、例外或明确缺口 |
| 推断透明 | 区分 direct、reported、behavioral、synthetic、speculative |
| 非重复 | 不得在 9 个 research 文件中复用同一批样例来伪造覆盖 |

### 8.2 Evidence 质量

| 检查项 | 通过标准 |
|---|---|
| 心智模型数量 | 3-7 个 |
| 每个模型证据 | 至少 5 条摘录，跨 2 类来源、3 个 source cluster |
| 决策启发式数量 | 5-12 条 |
| 反例记录 | 每个核心模型至少检查反例 |
| 张力 | 至少 2 条核心张力 |
| 表达 DNA | 至少 10 个可执行风格参数 |

### 8.3 Runtime 质量

| 测试 | 通过标准 |
|---|---|
| 已知立场测试 | 对 5 个已知问题方向一致 |
| 边缘问题测试 | 对未知问题表达不确定，不伪造事实 |
| 风格测试 | 100-300 字样本可辨识，但不过度模仿 |
| 事实问题测试 | 会先研究，不凭旧知识编 |
| 安全边界测试 | 高风险、隐私、冒充请求会降级或拒绝 |
| 回归测试 | 修改后通过历史 prompts |

## 9. 更新机制

活人、公司、主题 persona 必须支持增量更新。

更新触发条件：

- 距上次调研超过 90 天
- 用户提供新材料
- 出现重大事件、争议、作品、职位变化
- persona 在测试中出现明显偏差

更新流程：

1. 读取 `persona.json` 中的 `last_researched_at`
2. 只采集新增时间窗口内材料
3. 更新 `sources.jsonl` 和 `excerpts.jsonl`
4. 对比新证据是否：
   - 强化旧模型
   - 反驳旧模型
   - 产生新模型
   - 只属于短期噪音
5. 更新 `SKILL.md` 的最新动态、边界和版本号
6. 跑 regression tests

## 10. 交付定义

一个 persona 只有同时满足以下条件，才算完成：

- `SKILL.md` 可运行
- `persona.json` 描述版本、调研时间、覆盖度和状态
- `persona.json` 可作为运行时数据源，而不是 `SKILL.md` 的重复摘要；路由、模型、启发式、边界都必须能被机器读取
- `sources.jsonl` 完整记录来源，并包含来源簇、独立性折算和 payload 验证字段
- `excerpts.jsonl` 支撑核心结论，且来源分布不被单一来源簇垄断
- `coverage-matrix.md` 显示没有未声明的重大缺口
- `research/` 每个文件达到证据密度、反证和缺口要求
- `evidence/` 中的模型、启发式、表达 DNA 可审计，且核心模型跨 3 个以上来源簇
- `tests/` 中至少三类测试通过
- 诚实边界明确写出不能做什么
- `scripts/quality_check.py <persona_dir>/SKILL.md` 通过 runtime package 检查

否则只能标记为 `draft`。

如果对象材料极其丰富但当前采集只覆盖单一系列来源，例如只采集年度信、只采集一个播客、只采集一本文集，即使 raw 文件数和摘录数达标，也只能交付 `single-source-family-draft` 或 `style/domain framework`，不得标记为完整 persona。

如果最终只交付 `SKILL.md`，无论 `SKILL.md` 写得多像，都不得标记为 `research-backed` 或 `complete`；只能标记为 `prompt-only-draft`。
