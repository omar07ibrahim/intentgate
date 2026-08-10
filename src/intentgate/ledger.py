"""Hash-chained decision ledger primitives."""

from __future__ import annotations

from typing import Any

from .canonical import sha256_data

ZERO_SHA256 = "0" * 64


def state_sha256(state: dict[str, Any]) -> str:
    return sha256_data(state)


def make_entry(
    *,
    index: int,
    event: dict[str, Any],
    decision: dict[str, Any],
    before_state_sha256: str,
    after_state_sha256: str,
    previous_entry_sha256: str,
) -> dict[str, Any]:
    payload = {
        "index": index,
        "event": event,
        "event_sha256": sha256_data(event),
        "decision": decision,
        "before_state_sha256": before_state_sha256,
        "after_state_sha256": after_state_sha256,
        "previous_entry_sha256": previous_entry_sha256,
    }
    return {**payload, "entry_sha256": sha256_data(payload)}
