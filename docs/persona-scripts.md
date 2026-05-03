# Persona 工具脚本说明

本仓库的 `scripts/` 目录内置了从 `nuwa-skill` 方法论中复用并适配的辅助脚本。persona 生成流程应优先使用这些脚本处理字幕、调研摘要和运行时质量检查。

## 脚本清单

| 脚本 | 用途 | 阶段 |
|---|---|---|
| `scripts/download_subtitles.sh` | 从 YouTube 下载字幕，优先人工中文字幕，再英文，再自动字幕 | 数据采集 |
| `scripts/srt_to_transcript.py` | 将 SRT/VTT 清洗成可读 transcript | 数据清洗 |
| `scripts/merge_research.py` | 汇总 research 目录，生成 Phase 1.5 调研 review 表 | 调研检查 |
| `scripts/quality_check.py` | 检查 `SKILL.md` 的结构质量和运行时必备要素 | 质量验证 |

## 使用方式

### 下载字幕

```bash
scripts/download_subtitles.sh "<YouTube_URL>" "<persona_dir>/corpus/raw/transcripts"
```

要求：

- 本机已安装 `yt-dlp`
- 下载结果必须进入 `corpus/raw/transcripts/`
- 自动字幕必须在 `sources.jsonl` 中标记为降权来源，除非经过人工校对或与原始音视频交叉验证

### 清洗 transcript

```bash
python3 scripts/srt_to_transcript.py "<input.srt|input.vtt>" "<output.txt>"
```

输出的 transcript 可以进入：

```text
<persona_dir>/corpus/raw/transcripts/
```

清洗后的文本仍然不是证据本身。必须从 transcript 中抽取具体摘录，写入 `corpus/excerpts.jsonl`。

### 合并调研结果

```bash
python3 scripts/merge_research.py "<persona_dir>"
```

脚本会优先扫描：

```text
<persona_dir>/research/
```

如果没有新版 research 目录，会兼容扫描：

```text
<persona_dir>/references/research/
```

输出用于 Phase 1.5 调研 review，不等同于质量通过。

### 检查 SKILL.md

```bash
python3 scripts/quality_check.py "<persona_dir>/SKILL.md"
```

该脚本只做结构检查，包括：

- 心智模型数量
- 模型局限性
- 表达 DNA
- 诚实边界
- 内在张力
- 一手来源标记
- Agentic Protocol

它不能替代人工证据审查，也不能判断来源是否真实支撑模型。

## 复制到 persona 目录

生成可分发 persona 时，可以把这些脚本复制到 persona 内部：

```text
persona-name-perspective/
└── scripts/
    ├── download_subtitles.sh
    ├── srt_to_transcript.py
    ├── merge_research.py
    └── quality_check.py
```

这样 persona 目录可以自包含地完成补充调研、字幕处理和质量检查。

