from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

import pytest

from intentgate.canonical import canonical_bytes
from intentgate.cli import main


def test_cli_end_to_end(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    scenario = Path(__file__).resolve().parents[1] / "scenarios" / "hr-assistant.json"
    artifact = tmp_path / "run.json"
    report = tmp_path / "report.html"

    assert main(["run", str(scenario), "--output", str(artifact)]) == 0
    run_output = capsys.readouterr().out
    assert "4 effects" in run_output
    assert "artifact_sha256=06dba310" in run_output

    assert main(["verify", str(artifact)]) == 0
    verify_output = capsys.readouterr().out
    assert "verified 28 transitions, 4 effects" in verify_output
    assert "ac6316c40750e20" in verify_output

    assert main(["inspect", str(artifact)]) == 0
    inspect_output = capsys.readouterr().out
    assert "cross_tenant_effects: 0" in inspect_output
    assert "duplicate_effects: 0" in inspect_output

    assert main(["report", str(artifact), "--output", str(report)]) == 0
    assert "verified report written" in capsys.readouterr().out
    assert report.read_text(encoding="utf-8").startswith("<!doctype html>")


def test_cli_refuses_same_input_and_output(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    artifact = tmp_path / "same.json"
    artifact.write_text("{}", encoding="utf-8")
    assert main(["verify", str(artifact)]) == 2
    assert "artifact keys do not match" in capsys.readouterr().err

    assert main(["report", str(artifact), "--output", str(artifact)]) == 2
    assert "input and output paths must be different" in capsys.readouterr().err


def test_cli_reports_invalid_scenario_without_partial_output(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    scenario = tmp_path / "invalid.json"
    output = tmp_path / "run.json"
    scenario.write_text('{"format":"wrong"}', encoding="utf-8")
    assert main(["run", str(scenario), "--output", str(output)]) == 2
    assert "scenario keys mismatch" in capsys.readouterr().err
    assert not output.exists()


def test_cli_rejects_non_object_artifact(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    artifact = tmp_path / "array.json"
    artifact.write_text("[]", encoding="utf-8")
    assert main(["inspect", str(artifact)]) == 2
    assert "artifact must be a JSON object" in capsys.readouterr().err


def test_cli_output_is_canonical_json(tmp_path: Path) -> None:
    scenario = Path(__file__).resolve().parents[1] / "scenarios" / "hr-assistant.json"
    artifact = tmp_path / "run.json"
    assert main(["run", str(scenario), "--output", str(artifact)]) == 0
    raw = artifact.read_bytes()
    value = cast(dict[str, Any], json.loads(raw))
    assert raw.endswith(b"\n")
    assert value["summary"]["effects"] == 4
    assert raw == canonical_bytes(value) + b"\n"
