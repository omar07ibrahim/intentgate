from __future__ import annotations

import copy
import os
from pathlib import Path
from typing import Any

import pytest

from intentgate.canonical import sha256_data
from intentgate.errors import VerificationError
from intentgate.report import render_report, write_report
from intentgate.verify import verify_artifact


def _resign(artifact: dict[str, Any]) -> None:
    unsigned = dict(artifact)
    unsigned.pop("artifact_sha256")
    artifact["artifact_sha256"] = sha256_data(unsigned)


@pytest.mark.parametrize(
    "case",
    [
        "format",
        "extra-key",
        "artifact-digest",
        "scenario-digest",
        "scenario-contract",
        "policy-contract",
        "policy-digest",
        "entry-keys",
        "entry-replay",
        "effects",
        "summary",
        "final-state",
        "ledger-root",
    ],
)
def test_independent_verifier_rejects_tampering(
    artifact: dict[str, Any],
    case: str,
) -> None:
    value = copy.deepcopy(artifact)
    resign = True
    if case == "format":
        value["format"] = "intentgate.run.v2"
    elif case == "extra-key":
        value["unexpected"] = True
    elif case == "artifact-digest":
        value["artifact_sha256"] = "0" * 64
        resign = False
    elif case == "scenario-digest":
        value["scenario_sha256"] = "0" * 64
    elif case == "scenario-contract":
        value["scenario"]["events"][0]["unexpected"] = True
    elif case == "policy-contract":
        value["policy"]["max_ttl"] = 31
    elif case == "policy-digest":
        value["policy_sha256"] = "0" * 64
    elif case == "entry-keys":
        value["entries"][0].pop("event_sha256")
    elif case == "entry-replay":
        value["entries"][0]["decision"]["code"] = "forged"
    elif case == "effects":
        value["effects"].pop()
    elif case == "summary":
        value["summary"]["effects"] = 999
    elif case == "final-state":
        value["final_state_sha256"] = "0" * 64
    else:
        value["ledger_root_sha256"] = "0" * 64
    if resign:
        _resign(value)
    with pytest.raises(VerificationError):
        verify_artifact(value)


def test_verifier_normalizes_unexpected_contract_errors() -> None:
    with pytest.raises(VerificationError, match="artifact must be an object"):
        verify_artifact([])
    with pytest.raises(VerificationError, match="violates the replay contract"):
        verify_artifact(
            {
                "format": "intentgate.run.v1",
                "scenario": [],
                "scenario_sha256": "0" * 64,
                "policy": {},
                "policy_sha256": "0" * 64,
                "entries": [],
                "effects": [],
                "summary": {},
                "final_state_sha256": "0" * 64,
                "ledger_root_sha256": "0" * 64,
                "artifact_sha256": "0" * 64,
            }
        )


def test_report_is_verified_self_contained_and_escaped(
    artifact: dict[str, Any],
) -> None:
    report = render_report(artifact)
    lowered = report.lower()
    assert report.startswith("<!doctype html>")
    assert "<script" not in lowered
    assert "http://" not in lowered
    assert "https://" not in lowered
    assert "&lt;/policy&gt;" in report
    assert "</policy>" not in report
    assert "@media(max-width:520px)" in report
    assert artifact["artifact_sha256"] in report
    assert artifact["ledger_root_sha256"] in report
    assert report.count("<tr>") == 39


def test_report_refuses_unverified_input(artifact: dict[str, Any]) -> None:
    value = copy.deepcopy(artifact)
    value["entries"][0]["decision"]["code"] = "forged"
    with pytest.raises(VerificationError):
        render_report(value)


def test_report_atomic_write_and_collision(
    artifact: dict[str, Any],
    tmp_path: Path,
) -> None:
    destination = tmp_path / "report.html"
    write_report(destination, artifact)
    assert destination.read_text(encoding="utf-8") == render_report(artifact)

    blocked = tmp_path / "blocked.html"
    temporary = blocked.with_name(f".{blocked.name}.tmp-{os.getpid()}")
    temporary.write_text("collision", encoding="utf-8")
    with pytest.raises(FileExistsError):
        write_report(blocked, artifact)
    assert not temporary.exists()
    assert not blocked.exists()
