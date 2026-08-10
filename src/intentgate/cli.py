"""Command-line interface for IntentGate."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from .canonical import (
    MAX_ARTIFACT_BYTES,
    MAX_SCENARIO_BYTES,
    dump_json,
    load_json,
)
from .engine import run_scenario
from .errors import IntentGateError
from .model import parse_scenario
from .report import write_report
from .verify import verify_artifact


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="intentgate",
        description="Gate and independently replay untrusted AI action proposals.",
    )
    subcommands = parser.add_subparsers(dest="command", required=True)
    run = subcommands.add_parser("run", help="execute a bounded scenario")
    run.add_argument("scenario", type=Path)
    run.add_argument("--output", type=Path, required=True)
    verify = subcommands.add_parser("verify", help="independently replay an artifact")
    verify.add_argument("artifact", type=Path)
    inspect = subcommands.add_parser("inspect", help="print a verified summary")
    inspect.add_argument("artifact", type=Path)
    report = subcommands.add_parser("report", help="write a verified offline HTML report")
    report.add_argument("artifact", type=Path)
    report.add_argument("--output", type=Path, required=True)
    return parser


def _artifact(path: Path) -> tuple[dict[str, Any], dict[str, int]]:
    value = load_json(path, max_bytes=MAX_ARTIFACT_BYTES)
    if not isinstance(value, dict):
        raise IntentGateError("artifact must be a JSON object")
    summary = verify_artifact(value)
    return value, summary


def _distinct(source: Path, output: Path) -> None:
    if source.resolve() == output.resolve():
        raise IntentGateError("input and output paths must be different")


def _run(arguments: argparse.Namespace) -> int:
    _distinct(arguments.scenario, arguments.output)
    value = load_json(arguments.scenario, max_bytes=MAX_SCENARIO_BYTES)
    scenario = parse_scenario(value)
    artifact = run_scenario(scenario)
    dump_json(arguments.output, artifact, max_bytes=MAX_ARTIFACT_BYTES)
    summary = artifact["summary"]
    print(
        "IntentGate run complete: "
        f"{summary['effects']} effects, "
        f"{summary['blocked_proposals']} blocked proposals, "
        f"{summary['rejected_events']} rejected events"
    )
    print(f"artifact_sha256={artifact['artifact_sha256']}")
    return 0


def _verify(arguments: argparse.Namespace) -> int:
    artifact, summary = _artifact(arguments.artifact)
    print(
        "verified "
        f"{summary['events']} transitions, "
        f"{summary['effects']} effects, "
        f"ledger_root={artifact['ledger_root_sha256']}"
    )
    return 0


def _inspect(arguments: argparse.Namespace) -> int:
    artifact, summary = _artifact(arguments.artifact)
    print("IntentGate verified decision artifact")
    print(f"scenario: {artifact['scenario']['name']}")
    for key in (
        "proposals",
        "admitted_proposals",
        "blocked_proposals",
        "executed_proposals",
        "rejected_proposals",
        "expired_proposals",
        "rejected_events",
        "effects",
        "duplicate_effects",
        "cross_tenant_effects",
    ):
        print(f"{key}: {summary[key]}")
    print(f"scenario_sha256: {artifact['scenario_sha256']}")
    print(f"policy_sha256: {artifact['policy_sha256']}")
    print(f"ledger_root_sha256: {artifact['ledger_root_sha256']}")
    print(f"artifact_sha256: {artifact['artifact_sha256']}")
    return 0


def _report(arguments: argparse.Namespace) -> int:
    _distinct(arguments.artifact, arguments.output)
    artifact, _ = _artifact(arguments.artifact)
    write_report(arguments.output, artifact)
    print(f"verified report written to {arguments.output}")
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    arguments = _parser().parse_args(argv)
    try:
        if arguments.command == "run":
            return _run(arguments)
        if arguments.command == "verify":
            return _verify(arguments)
        if arguments.command == "inspect":
            return _inspect(arguments)
        return _report(arguments)
    except (IntentGateError, OSError) as error:
        print(f"intentgate: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
