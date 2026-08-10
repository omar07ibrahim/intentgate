from __future__ import annotations

import copy
import os
from pathlib import Path
from typing import Any

import pytest

from intentgate.canonical import canonical_bytes, dump_json, load_json, loads_json, sha256_data
from intentgate.errors import ContractError
from intentgate.model import parse_scenario


@pytest.mark.parametrize(
    ("payload", "message"),
    [
        (b'{"key":1,"key":2}', "duplicate JSON key"),
        (b'{"value":NaN}', "non-finite JSON number"),
        (b'{"value":Infinity}', "non-finite JSON number"),
        (b'{"value":', "invalid JSON input"),
        (b'"\\xff"', "invalid JSON input"),
        (b"\xff", "strict UTF-8"),
    ],
)
def test_strict_json_rejects_ambiguous_input(payload: bytes, message: str) -> None:
    with pytest.raises(ContractError, match=message):
        loads_json(payload, max_bytes=256)


def test_json_size_bound_is_checked_before_parsing() -> None:
    with pytest.raises(ContractError, match="exceeds 4 bytes"):
        loads_json(b'{"a":1}', max_bytes=4)


def test_canonical_json_is_stable_and_unicode_preserving() -> None:
    left = {"z": 2, "a": "cafe", "nested": {"b": True, "a": None}}
    right = {"nested": {"a": None, "b": True}, "a": "cafe", "z": 2}
    assert canonical_bytes(left) == canonical_bytes(right)
    assert sha256_data(left) == sha256_data(right)


def test_canonical_json_rejects_unsupported_and_recursive_values() -> None:
    with pytest.raises(ContractError, match="not canonical-JSON serializable"):
        canonical_bytes({"bad": {1, 2}})
    recursive: list[Any] = []
    recursive.append(recursive)
    with pytest.raises(ContractError, match="not canonical-JSON serializable"):
        canonical_bytes(recursive)


def test_atomic_json_round_trip_and_bound(tmp_path: Path) -> None:
    destination = tmp_path / "artifact.json"
    dump_json(destination, {"value": 1}, max_bytes=32)
    assert destination.read_bytes() == b'{"value":1}\n'
    assert load_json(destination, max_bytes=32) == {"value": 1}
    with pytest.raises(ContractError, match="JSON output exceeds"):
        dump_json(destination, {"value": "too-large"}, max_bytes=8)
    destination.write_bytes(b"012345")
    with pytest.raises(ContractError, match="JSON input exceeds"):
        load_json(destination, max_bytes=5)


def test_atomic_writer_cleans_stale_attempt_on_failure(tmp_path: Path) -> None:
    destination = tmp_path / "artifact.json"
    temporary = destination.with_name(f".{destination.name}.tmp-{os.getpid()}")
    temporary.write_text("collision", encoding="utf-8")
    with pytest.raises(FileExistsError):
        dump_json(destination, {"value": 1}, max_bytes=32)
    assert not temporary.exists()
    assert not destination.exists()


@pytest.mark.parametrize(
    ("case", "message"),
    [
        ("root-extra", "keys mismatch"),
        ("format", "scenario.format is unsupported"),
        ("duplicate-principal", "principal ids must be unique"),
        ("principals-type", "scenario.principals must be an array"),
        ("events-type", "scenario.events must be an array"),
        ("unsupported-role", "role is unsupported"),
        ("empty-id", "must be a non-empty string"),
        ("event-kind", "kind is unsupported"),
        ("event-extra", "keys mismatch"),
        ("event-bool-at", "must be an integer"),
        ("proposal-extra", "keys mismatch"),
        ("classification", "classification is unsupported"),
        ("expiry", "expires_at must be greater"),
        ("bool-count", "must be an integer"),
        ("issued-at", "must equal proposal.issued_at"),
        ("decision", "decision is unsupported"),
        ("nonce", "invalid format"),
        ("nonmonotonic", "must be non-decreasing"),
    ],
)
def test_scenario_contract_rejects_invalid_variants(
    scenario_data: dict[str, Any],
    case: str,
    message: str,
) -> None:
    value = copy.deepcopy(scenario_data)
    if case == "root-extra":
        value["unexpected"] = True
    elif case == "format":
        value["format"] = "unknown"
    elif case == "duplicate-principal":
        value["principals"][1]["id"] = value["principals"][0]["id"]
    elif case == "principals-type":
        value["principals"] = {}
    elif case == "events-type":
        value["events"] = {}
    elif case == "unsupported-role":
        value["principals"][0]["role"] = "owner"
    elif case == "empty-id":
        value["principals"][0]["id"] = ""
    elif case == "event-kind":
        value["events"][0]["kind"] = "unknown"
    elif case == "event-extra":
        value["events"][0]["unexpected"] = True
    elif case == "event-bool-at":
        value["events"][0]["at"] = True
    elif case == "proposal-extra":
        value["events"][0]["proposal"]["unexpected"] = True
    elif case == "classification":
        value["events"][0]["proposal"]["classification"] = "secret"
    elif case == "expiry":
        value["events"][0]["proposal"]["expires_at"] = 1
    elif case == "bool-count":
        value["events"][0]["proposal"]["effect_count"] = True
    elif case == "issued-at":
        value["events"][0]["proposal"]["issued_at"] = 2
    elif case == "decision":
        value["events"][1]["decision"] = "maybe"
    elif case == "nonce":
        value["events"][2]["nonce"] = "INVALID NONCE"
    else:
        value["events"][1]["at"] = 0
    with pytest.raises(ContractError, match=message):
        parse_scenario(value)


def test_scenario_contract_enforces_collection_bounds(
    scenario_data: dict[str, Any],
) -> None:
    principals = copy.deepcopy(scenario_data)
    principals["principals"] = [principals["principals"][0]] * 65
    with pytest.raises(ContractError, match="exceeds 64 items"):
        parse_scenario(principals)

    events = copy.deepcopy(scenario_data)
    events["events"] = [events["events"][0]] * 257
    with pytest.raises(ContractError, match="exceeds 256 items"):
        parse_scenario(events)


def test_scenario_root_must_be_an_object() -> None:
    with pytest.raises(ContractError, match="scenario must be an object"):
        parse_scenario([])
