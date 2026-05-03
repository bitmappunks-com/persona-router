# Dokobot 搜索先行与归档准入指南

> 目的：为 persona 生成流程提供稳定的来源发现、筛选和归档规则。默认先用 `dokobot search` 做候选发现和有用性判断；只有候选来源通过准入检查后，才允许写入 `corpus/raw/src_*`。不要先批量 `read` 或下载，再事后发现内容无效。

## 1. 核心规则

Persona 采集阶段的第一步是搜索，不是读取：

```bash
dokobot search --num 10 "<person> <specific source query>"
```

`dokobot search` 的结果只能用于候选发现和初筛，不能直接进入 `excerpts.jsonl`，也不能支撑 `SKILL.md`。

写入任何 `corpus/raw/src_*` 文件之前，必须先完成 usefulness gate：

- 这个 URL 是否是 canonical 原始来源？
- 是否有明确作者、机构、日期或官方发布方？
- 是否能提供 persona 证据，而不只是索引、菜单、空 PDF、营销页或搜索摘要？
- 来源层级是 P1/P2/P3/P4/P5 还是只能 discovery_only？
- 是否存在垃圾信号：SEO、搬运、语录拼贴、无作者、无日期、AI 摘要、内容农场？
- 如果是 PDF、视频、音频或动态页面，是否能拿到正文、transcript 或可审计文本？

只有通过 gate 的来源，才允许读取、下载或转写到 `corpus/raw/`。

## 2. 沙箱和权限

在 Codex 的命令沙箱中运行 Dokobot CLI 时，仍应使用非沙箱权限。原因有两类：

- `dokobot search` 需要访问网络和远程服务。
- `dokobot doko/read` 需要看到本机 Chrome native bridge 进程；沙箱可能隐藏该进程并误报不可用。

Codex 调用示例：

```json
{
  "cmd": "dokobot search --num 10 \"Warren Buffett official shareholder letter Berkshire Hathaway 1989\"",
  "sandbox_permissions": "require_escalated",
  "justification": "Allow Dokobot search to access the web for source discovery?"
}
```

```json
{
  "cmd": "dokobot doko list",
  "sandbox_permissions": "require_escalated",
  "justification": "Allow Dokobot to inspect the local Chrome bridge process outside the sandbox?"
}
```

## 3. 搜索查询协议

每个调研维度都要构造具体查询，不要只搜人名。

系统性长文本：

```bash
dokobot search --num 10 "\"Warren Buffett\" official shareholder letter Berkshire Hathaway"
dokobot search --num 10 "\"Warren Buffett\" annual letter intrinsic value owner earnings"
```

长对话和 transcript：

```bash
dokobot search --num 10 "\"Warren Buffett\" annual meeting transcript"
dokobot search --num 10 "\"Warren Buffett\" interview transcript Charlie Munger"
```

决策和行动：

```bash
dokobot search --num 10 "\"Berkshire Hathaway\" acquisition Buffett official release"
dokobot search --num 10 "\"Berkshire Hathaway\" share repurchase Buffett letter"
```

失败、争议和反方：

```bash
dokobot search --num 10 "\"Warren Buffett\" mistake textile Berkshire letter"
dokobot search --num 10 "\"Warren Buffett\" criticism controversy Berkshire"
```

近期动态：

```bash
dokobot search --num 10 "\"Warren Buffett\" 2025 Berkshire Hathaway official Greg Abel"
dokobot search --num 10 "\"Berkshire Hathaway\" 2026 Warren Buffett official"
```

## 4. 候选来源判断

`dokobot search` 返回结果后，先写候选判断，不要立刻写 `src_*`。

推荐候选记录格式：

```json
{
  "candidate_id": "cand_0001",
  "query": "\"Warren Buffett\" annual meeting transcript",
  "found_by": "dokobot search",
  "title": "Example Result",
  "url": "https://example.com/result",
  "initial_source_tier": "P1",
  "expected_use": ["mental_model", "expression"],
  "usefulness": "accept",
  "usefulness_reason": "Official Berkshire transcript page with full Q&A text.",
  "raw_plan": "read_html",
  "do_not_write_reason": null
}
```

`usefulness` 取值：

- `accept`：值得归档，允许写入 `corpus/raw/src_*`
- `inspect_more`：需要打开页面确认正文、作者、日期或 canonical 链接
- `discovery_only`：只能用于找到原始来源，不可入证据
- `reject`：垃圾来源或无证据价值，不可写 raw

默认拒绝写入 raw 的情况：

- 搜索结果页、索引菜单、站内导航页，除非它本身用于证明来源覆盖
- PDF 页面被工具读取后只有标题和 URL，没有正文
- 语录站、SEO 人物页、成功学文章、无作者转载
- 新闻短讯没有关键原文或不能追溯到官方材料
- transcript 无法确认原始音视频或发布方
- 内容只有摘要，没有可摘录的原文语境

## 5. 归档方式

通过 usefulness gate 后，再选择归档方式。

HTML / 动态页面：

```bash
dokobot read --local --device <device_id> <url> --screens 5 --timeout 60 -o <persona_dir>/corpus/raw/<kind>/src_0001.md
```

PDF：

```bash
curl -fsSL <pdf_url> -o <persona_dir>/corpus/raw/pdf-originals/src_0001.pdf
pdftotext -layout <persona_dir>/corpus/raw/pdf-originals/src_0001.pdf <persona_dir>/corpus/raw/pdf-text/src_0001.txt
```

PDF 不要只用 `dokobot read` 归档。若 `dokobot read` 对 PDF 只返回标题和 URL，该结果必须标记为无效，不能进入证据链。

视频 / 音频：

- 优先找官方 transcript。
- 没有 transcript 时，保存原始 URL 和字幕/转写文件。
- 自动字幕必须标记为 `limited`，除非人工校对或交叉验证。

## 6. 来源入库

只有写入 raw 后，才允许进入 `sources.jsonl`。`sources.jsonl` 必须保留 search 和 usefulness 记录：

```json
{
  "source_id": "src_0001",
  "title": "Example Interview",
  "url": "https://example.com/interview",
  "found_by": "dokobot search",
  "query": "\"Warren Buffett\" annual meeting transcript",
  "candidate_id": "cand_0001",
  "usefulness": "accept",
  "usefulness_reason": "Official full transcript with date and speaker context.",
  "read_by": "dokobot read --local",
  "date_accessed": "2026-05-03",
  "source_tier": "P1",
  "source_type": "interview",
  "medium": "text",
  "language": "en",
  "reliability": 0.9,
  "admission_status": "accepted",
  "admission_reason": "Canonical interview page read through local Chrome.",
  "is_original": true,
  "is_derivative": false,
  "garbage_signals": [],
  "allowed_uses": ["mental_model", "expression"],
  "raw_path": "corpus/raw/transcripts/src_0001.md"
}
```

如果候选被拒绝，可以写入 candidate log 或 `source-quality.md`，但不要创建 `src_*` raw 文件。

## 7. Persona 数据采集流程

推荐顺序：

1. 用 `dokobot search` 发现候选来源。
2. 对每个候选做 usefulness gate。
3. 只对 `accept` 来源执行读取、下载、转写或正文抽取。
4. 写入 `corpus/raw/` 后，检查文件是否有正文和可摘录内容。
5. 通过正文检查后写入 `sources.jsonl`。
6. 只从本地 raw 文件抽取摘录到 `excerpts.jsonl`。
7. 基于摘录生成 `research/`、`evidence/`、`SKILL.md` 和 `persona.json`。

硬性检查：如果 raw 文件只有标题、URL、菜单或 3 行以内内容，默认无效，必须移出证据链并记录失败原因。

## 8. 故障判断表

| 现象 | 优先判断 | 处理 |
|---|---|---|
| `dokobot search` 返回少或差 | 查询过宽或平台收录差 | 换具体 query，不要直接改用批量 read |
| `API key required for remote mode` | search 需要远程配置 | 记录 search 不可用并询问用户是否配置；不要伪装成已用 Dokobot search |
| `No available devices` | 沙箱看不到 bridge 进程 | 仅影响 doko/read；用非沙箱权限重跑 |
| `No local bridge running` | 沙箱隔离或 extension 未加载 | 非沙箱重跑；若仍失败，点击 Chrome 扩展图标 |
| PDF raw 只有标题和 URL | Dokobot 未抽取 PDF 正文 | 改用官方 PDF + `pdftotext`，或拒绝入证据 |
| raw 文件只有菜单/索引 | 归档对象不是真正证据源 | 标记 `discovery_only`，不要从中抽核心证据 |
| 读取超时 | 页面慢、登录态问题或 screens 太多 | 先确认候选有用，再增加 `--timeout` 或换归档方式 |

## 9. Agent 指令片段

```text
Start persona source collection with dokobot search.
Do not write any corpus/raw/src_* file before judging whether the candidate source is useful.
For each search result, classify usefulness as accept, inspect_more, discovery_only, or reject.
Only accepted sources may be read, downloaded, transcribed, or written into corpus/raw/.
After writing raw, verify that the file contains substantive source text, not just a title, URL, menu, or empty PDF wrapper.
When using dokobot doko/read inside Codex, run with non-sandbox permissions because the sandbox may hide the Chrome native bridge process.
Never treat search results, summaries, empty reads, or unverified PDFs as evidence.
```
