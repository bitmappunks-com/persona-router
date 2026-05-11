from __future__ import annotations

import re
from dataclasses import dataclass


MENTION_RE = re.compile(r"@([A-Za-z0-9_\-\u4e00-\u9fff]+)")


@dataclass(frozen=True)
class ParsedInput:
    intent: str
    mentioned_handles: list[str]
    topic: str | None
    round_instruction: str | None
    raw_text: str


def parse_input(text: str) -> ParsedInput:
    raw_text = text.strip()
    lowered = raw_text.lower()
    mentioned = MENTION_RE.findall(raw_text)

    if not raw_text:
        return ParsedInput("empty", [], None, None, raw_text)

    if lowered in {"next", "next round", "continue", "again"} or raw_text in {"再讨论一轮", "继续", "下一轮"}:
        return ParsedInput("next_round", [], None, raw_text, raw_text)

    if lowered in {"list agents", "agents", "list"} or raw_text in {"有哪些 agent", "列出 agent", "列出 agents"}:
        return ParsedInput("list_agents", [], None, None, raw_text)

    first_token = lowered.split(maxsplit=1)[0]
    if first_token in {"active", "activate", "deactivate", "only"}:
        remainder = raw_text.split(maxsplit=1)[1] if len(raw_text.split(maxsplit=1)) > 1 else ""
        topic = strip_mentions(remainder).strip() or None
        intent = {
            "active": "set_active",
            "activate": "activate",
            "deactivate": "deactivate",
            "only": "set_active",
        }[first_token]
        return ParsedInput(intent, mentioned, topic, None, raw_text)

    if mentioned:
        topic = strip_mentions(raw_text).strip()
        topic = normalize_topic_prefix(topic)
        return ParsedInput("topic_with_mentions", mentioned, topic or None, None, raw_text)

    return ParsedInput("topic", [], normalize_topic_prefix(raw_text), None, raw_text)


def strip_mentions(text: str) -> str:
    return MENTION_RE.sub("", text).strip()


def normalize_topic_prefix(text: str) -> str:
    normalized = text.strip()
    for prefix in ("topic:", "Topic:", "主题：", "主题:"):
        if normalized.startswith(prefix):
            return normalized[len(prefix):].strip()
    return normalized

