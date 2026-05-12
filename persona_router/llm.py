from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Iterator

from .executor import LLMClient


class LLMConfigurationError(RuntimeError):
    """Raised when an LLM client cannot be initialized."""


DEFAULT_BASE_URL = "https://api.deepseek.com/v1"
DEFAULT_MODEL = "deepseek-chat"


@dataclass(frozen=True)
class OpenAICompatibleClient:
    """OpenAI-compatible Chat Completions adapter (works with DeepSeek, OpenAI, etc.)."""

    api_key: str
    base_url: str = DEFAULT_BASE_URL
    default_model: str = DEFAULT_MODEL
    max_tokens: int = 1024

    def complete(self, system: str, developer: dict[str, Any], model: str, temperature: float) -> str:
        client = _make_client(self.api_key, self.base_url)
        chosen_model = self._pick_model(model)
        user_content = _format_developer_payload(developer)
        response = client.chat.completions.create(
            model=chosen_model,
            temperature=temperature,
            max_tokens=self.max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_content},
            ],
        )
        return _collect_text(response)

    def stream(self, system: str, developer: dict[str, Any], model: str, temperature: float) -> Iterator[str]:
        client = _make_client(self.api_key, self.base_url)
        chosen_model = self._pick_model(model)
        user_content = _format_developer_payload(developer)
        completion = client.chat.completions.create(
            model=chosen_model,
            temperature=temperature,
            max_tokens=self.max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_content},
            ],
            stream=True,
        )
        for event in completion:
            choices = getattr(event, "choices", None) or []
            if not choices:
                continue
            delta = getattr(choices[0], "delta", None)
            if delta is None:
                continue
            chunk = getattr(delta, "content", None)
            if isinstance(chunk, str) and chunk:
                yield chunk
            elif isinstance(chunk, list):
                for piece in chunk:
                    if isinstance(piece, dict) and piece.get("type") == "text":
                        text = str(piece.get("text", ""))
                        if text:
                            yield text

    def _pick_model(self, model: str) -> str:
        return model if model and model != "default" else self.default_model


def _make_client(api_key: str, base_url: str):
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise LLMConfigurationError(
            "openai SDK is not installed. Run: pip install -e '.[llm]' "
            "(or pip install openai)"
        ) from exc
    return OpenAI(api_key=api_key, base_url=base_url)


def _format_developer_payload(developer: dict[str, Any]) -> str:
    topic = developer.get("topic", "")
    boundaries = developer.get("boundaries") or []
    excerpt = developer.get("skill_excerpt", "")
    allow_cross = developer.get("allow_cross_questions", True)
    previous = developer.get("previous_turns") or []
    host_brief = developer.get("host_brief")
    other_members = developer.get("other_members") or []

    parts: list[str] = []
    parts.append(f"# Topic\n{topic}")
    if other_members:
        formatted_members = "\n".join(
            f"- @{m.get('handle','?')} ({m.get('display_name','')}) · {m.get('stance','')[:60]}".rstrip(" ·")
            for m in other_members
        )
        parts.append(f"# Other members in the group\n{formatted_members}")
    if host_brief:
        parts.append(f"# host_brief（调度准备）\n{host_brief}")
    if boundaries:
        formatted = "\n".join(f"- {item}" for item in boundaries)
        parts.append(f"# Boundaries\n{formatted}")
    if excerpt:
        parts.append(f"# Persona skill excerpt\n{excerpt}")
    parts.append(
        f"# Turn rules\nAllow cross-questions: {'yes' if allow_cross else 'no'}.\n"
        "Stay in character. Answer only for your assigned turn. Be concise."
    )
    if previous:
        formatted_turns = "\n\n".join(
            f"[round {turn.get('round_index')} · @{_handle_from_turn(turn)}]\n{turn.get('content', '')}"
            for turn in previous
        )
        parts.append(f"# Previous turns\n{formatted_turns}")
    return "\n\n".join(parts)


def _handle_from_turn(turn: dict[str, Any]) -> str:
    metadata = turn.get("metadata") or {}
    handle = metadata.get("handle") if isinstance(metadata, dict) else None
    return handle or turn.get("agent_id", "agent")


def _collect_text(response: Any) -> str:
    try:
        choice = response.choices[0]
    except (AttributeError, IndexError):
        return ""
    message = getattr(choice, "message", None)
    if message is None:
        return ""
    content = getattr(message, "content", None)
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        chunks: list[str] = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                chunks.append(str(block.get("text", "")))
        return "\n".join(chunks).strip()
    return ""


def build_default_client() -> OpenAICompatibleClient | None:
    """Return an OpenAI-compatible adapter when configured via env, else None.

    Priority for the API key: PERSONA_ROUTER_API_KEY > DEEPSEEK_API_KEY > OPENAI_API_KEY.
    Base URL defaults to DeepSeek if DEEPSEEK_API_KEY is set, OpenAI otherwise, and can
    be overridden with PERSONA_ROUTER_BASE_URL.
    """
    api_key = (
        os.environ.get("PERSONA_ROUTER_API_KEY")
        or os.environ.get("DEEPSEEK_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
    )
    if not api_key:
        return None

    if os.environ.get("PERSONA_ROUTER_BASE_URL"):
        base_url = os.environ["PERSONA_ROUTER_BASE_URL"]
    elif os.environ.get("DEEPSEEK_API_KEY"):
        base_url = "https://api.deepseek.com/v1"
    elif os.environ.get("OPENAI_API_KEY"):
        base_url = "https://api.openai.com/v1"
    else:
        base_url = DEFAULT_BASE_URL

    default_model = os.environ.get("PERSONA_ROUTER_MODEL")
    if not default_model:
        default_model = "deepseek-chat" if "deepseek" in base_url else "gpt-4o-mini"

    max_tokens_raw = os.environ.get("PERSONA_ROUTER_MAX_TOKENS", "1024")
    try:
        max_tokens = int(max_tokens_raw)
    except ValueError:
        max_tokens = 1024

    return OpenAICompatibleClient(
        api_key=api_key,
        base_url=base_url,
        default_model=default_model,
        max_tokens=max_tokens,
    )


def diagnose_llm_environment() -> dict[str, Any]:
    """Report whether the LLM dependencies and env are wired up correctly."""
    api_key_present = bool(
        os.environ.get("PERSONA_ROUTER_API_KEY")
        or os.environ.get("DEEPSEEK_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
    )
    try:
        import openai  # noqa: F401
        sdk_installed = True
    except ImportError:
        sdk_installed = False

    provider: str | None
    if os.environ.get("DEEPSEEK_API_KEY"):
        provider = "deepseek"
    elif os.environ.get("OPENAI_API_KEY"):
        provider = "openai"
    elif os.environ.get("PERSONA_ROUTER_API_KEY"):
        provider = "custom"
    else:
        provider = None

    if api_key_present and sdk_installed:
        ready = True
        hint = None
    elif not api_key_present and not sdk_installed:
        ready = False
        hint = (
            "Set DEEPSEEK_API_KEY (or OPENAI_API_KEY) and run: pip install -e '.[llm]'"
        )
    elif not api_key_present:
        ready = False
        hint = "Set DEEPSEEK_API_KEY (or OPENAI_API_KEY) in the shell that runs uvicorn."
    else:
        ready = False
        hint = "openai SDK missing. Run: pip install -e '.[llm]'"

    return {
        "api_key_set": api_key_present,
        "sdk_installed": sdk_installed,
        "provider": provider,
        "ready": ready,
        "hint": hint,
    }
