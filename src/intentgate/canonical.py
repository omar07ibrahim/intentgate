"""Strict JSON, canonical hashing, and bounded atomic output helpers."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

from .errors import ContractError

MAX_SCENARIO_BYTES = 256 * 1024
MAX_ARTIFACT_BYTES = 8 * 1024 * 1024


def _reject_constant(value: str) -> None:
    raise ContractError(f"non-finite JSON number is forbidden: {value}")


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ContractError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def loads_json(data: bytes, *, max_bytes: int) -> Any:
    if len(data) > max_bytes:
        raise ContractError(f"JSON input exceeds {max_bytes} bytes")
    try:
        text = data.decode("utf-8", errors="strict")
    except UnicodeDecodeError as error:
        raise ContractError("JSON input must be strict UTF-8") from error
    try:
        return json.loads(
            text,
            object_pairs_hook=_unique_object,
            parse_constant=_reject_constant,
        )
    except ContractError:
        raise
    except (json.JSONDecodeError, RecursionError) as error:
        raise ContractError("invalid JSON input") from error


def load_json(path: str | Path, *, max_bytes: int) -> Any:
    with Path(path).open("rb") as stream:
        data = stream.read(max_bytes + 1)
    return loads_json(data, max_bytes=max_bytes)


def canonical_bytes(value: Any) -> bytes:
    try:
        text = json.dumps(
            value,
            ensure_ascii=False,
            allow_nan=False,
            sort_keys=True,
            separators=(",", ":"),
        )
    except (TypeError, ValueError, RecursionError) as error:
        raise ContractError("value is not canonical-JSON serializable") from error
    return text.encode("utf-8")


def sha256_data(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def dump_json(path: str | Path, value: Any, *, max_bytes: int) -> None:
    destination = Path(path)
    payload = canonical_bytes(value) + b"\n"
    if len(payload) > max_bytes:
        raise ContractError(f"JSON output exceeds {max_bytes} bytes")
    temporary = destination.with_name(f".{destination.name}.tmp-{os.getpid()}")
    try:
        with temporary.open("xb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, destination)
    finally:
        try:
            temporary.unlink()
        except FileNotFoundError:
            pass
