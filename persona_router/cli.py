from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .commands import parse_input
from .executor import run_mock_round
from .planner import build_turn_plan
from .registry import RegistryError, default_registry_paths, load_registry
from .session import RouterSession, load_session, save_session, session_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="persona-router")
    parser.add_argument("--root", default=".", help="Repository root")
    parser.add_argument("--registry", action="append", help="Registry JSON path; can be repeated")
    parser.add_argument("--json", action="store_true", help="Emit JSON")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("validate")
    list_agents = sub.add_parser("list-agents")
    list_agents.add_argument("--domain")
    list_agents.add_argument("--source")
    list_agents.add_argument("--risk-level", choices=["low", "medium", "high"])

    session_new = sub.add_parser("session")
    session_sub = session_new.add_subparsers(dest="session_command", required=True)
    session_sub.add_parser("new")

    active = sub.add_parser("active")
    active.add_argument("session_id")
    active.add_argument("handles", nargs="+")

    round_cmd = sub.add_parser("round")
    round_cmd.add_argument("session_id")
    round_cmd.add_argument("text")

    next_cmd = sub.add_parser("next")
    next_cmd.add_argument("session_id")

    args = parser.parse_args(argv)
    root = Path(args.root).resolve()
    registry_paths = [Path(item) for item in args.registry] if args.registry else default_registry_paths(root)

    try:
        registry = load_registry(registry_paths, root=root)
        if args.command == "validate":
            payload = {"ok": True, "agents": len(registry.agents), "registries": [str(path) for path in registry_paths]}
            return emit(payload, args.json)
        if args.command == "list-agents":
            return emit(
                registry.list_agents(domain=args.domain, source=args.source, risk_level=args.risk_level),
                args.json,
            )
        if args.command == "session" and args.session_command == "new":
            session = RouterSession.new(registry)
            path = session_path(root, session.session_id)
            save_session(session, path)
            return emit({"session": session.to_dict(), "path": str(path)}, args.json)
        if args.command == "active":
            session = load_session(session_path(root, args.session_id))
            handles = " ".join(f"@{item.removeprefix('@')}" for item in args.handles)
            parsed = parse_input(f"active {handles}")
            session.apply_input(parsed, registry)
            save_session(session, session_path(root, args.session_id))
            return emit(session.to_dict(), args.json)
        if args.command == "round":
            session = load_session(session_path(root, args.session_id))
            parsed = parse_input(args.text)
            mentioned = session.apply_input(parsed, registry)
            plan = build_turn_plan(session, registry, mentioned)
            result = run_mock_round(session, registry, plan)
            save_session(session, session_path(root, args.session_id))
            return emit({"session": session.to_dict(), "round": result.to_dict()}, args.json)
        if args.command == "next":
            session = load_session(session_path(root, args.session_id))
            parsed = parse_input("next round")
            mentioned = session.apply_input(parsed, registry)
            plan = build_turn_plan(session, registry, mentioned)
            result = run_mock_round(session, registry, plan)
            save_session(session, session_path(root, args.session_id))
            return emit({"session": session.to_dict(), "round": result.to_dict()}, args.json)
    except (RegistryError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    print(f"error: unhandled command {args.command}", file=sys.stderr)
    return 2


def emit(payload: object, as_json: bool) -> int:
    if as_json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0
    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict) and "handle" in item:
                print(f"@{item['handle']}\t{item.get('display_name', '')}")
            else:
                print(item)
        return 0
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
