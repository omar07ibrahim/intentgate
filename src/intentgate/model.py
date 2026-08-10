"""Bounded scenario contract for untrusted model proposals."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from .errors import ContractError

FORMAT = "intentgate.scenario.v1"
MAX_PRINCIPALS = 64
MAX_EVENTS = 256
MAX_TEXT = 512
_ID = re.compile(r"^[a-z][a-z0-9_.:-]{0,63}$")
_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_ROLES = {"model", "employee", "manager", "privacy", "executor"}
_CLASSIFICATIONS = {"public", "internal", "confidential", "restricted"}


def _object(value: Any, context: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ContractError(f"{context} must be an object")
    return value


def _array(value: Any, context: str, maximum: int) -> list[Any]:
    if not isinstance(value, list):
        raise ContractError(f"{context} must be an array")
    if len(value) > maximum:
        raise ContractError(f"{context} exceeds {maximum} items")
    return value


def _keys(value: dict[str, Any], expected: set[str], context: str) -> None:
    actual = set(value)
    if actual != expected:
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        raise ContractError(f"{context} keys mismatch; missing={missing}, extra={extra}")


def _string(
    value: Any,
    context: str,
    *,
    maximum: int = 64,
    pattern: re.Pattern[str] | None = None,
) -> str:
    if not isinstance(value, str) or not value or len(value) > maximum:
        raise ContractError(f"{context} must be a non-empty string up to {maximum} characters")
    if pattern is not None and pattern.fullmatch(value) is None:
        raise ContractError(f"{context} has an invalid format")
    return value


def _integer(value: Any, context: str, *, minimum: int, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ContractError(f"{context} must be an integer")
    if not minimum <= value <= maximum:
        raise ContractError(f"{context} must be in [{minimum}, {maximum}]")
    return value


@dataclass(frozen=True, slots=True)
class Principal:
    principal_id: str
    tenant: str
    role: str

    def to_data(self) -> dict[str, Any]:
        return {"id": self.principal_id, "tenant": self.tenant, "role": self.role}


@dataclass(frozen=True, slots=True)
class Proposal:
    proposal_id: str
    tenant: str
    actor: str
    action: str
    subject: str
    resource: str
    classification: str
    effect_count: int
    issued_at: int
    expires_at: int
    model_run_sha256: str
    justification: str

    def to_data(self) -> dict[str, Any]:
        return {
            "proposal_id": self.proposal_id,
            "tenant": self.tenant,
            "actor": self.actor,
            "action": self.action,
            "subject": self.subject,
            "resource": self.resource,
            "classification": self.classification,
            "effect_count": self.effect_count,
            "issued_at": self.issued_at,
            "expires_at": self.expires_at,
            "model_run_sha256": self.model_run_sha256,
            "justification": self.justification,
        }


@dataclass(frozen=True, slots=True)
class ProposalEvent:
    at: int
    proposal: Proposal

    def to_data(self) -> dict[str, Any]:
        return {"kind": "proposal", "at": self.at, "proposal": self.proposal.to_data()}


@dataclass(frozen=True, slots=True)
class ApprovalEvent:
    at: int
    proposal_id: str
    actor: str
    decision: str

    def to_data(self) -> dict[str, Any]:
        return {
            "kind": "approval",
            "at": self.at,
            "proposal_id": self.proposal_id,
            "actor": self.actor,
            "decision": self.decision,
        }


@dataclass(frozen=True, slots=True)
class ExecuteEvent:
    at: int
    proposal_id: str
    actor: str
    nonce: str

    def to_data(self) -> dict[str, Any]:
        return {
            "kind": "execute",
            "at": self.at,
            "proposal_id": self.proposal_id,
            "actor": self.actor,
            "nonce": self.nonce,
        }


Event = ProposalEvent | ApprovalEvent | ExecuteEvent


@dataclass(frozen=True, slots=True)
class Scenario:
    name: str
    principals: tuple[Principal, ...]
    events: tuple[Event, ...]

    def to_data(self) -> dict[str, Any]:
        return {
            "format": FORMAT,
            "name": self.name,
            "principals": [principal.to_data() for principal in self.principals],
            "events": [event.to_data() for event in self.events],
        }


def _principal(value: Any, index: int) -> Principal:
    data = _object(value, f"principals[{index}]")
    _keys(data, {"id", "tenant", "role"}, f"principals[{index}]")
    principal_id = _string(data["id"], f"principals[{index}].id", pattern=_ID)
    tenant = _string(data["tenant"], f"principals[{index}].tenant", pattern=_ID)
    role = _string(data["role"], f"principals[{index}].role", pattern=_ID)
    if role not in _ROLES:
        raise ContractError(f"principals[{index}].role is unsupported")
    return Principal(principal_id, tenant, role)


def _proposal(value: Any, context: str) -> Proposal:
    data = _object(value, context)
    expected = {
        "proposal_id",
        "tenant",
        "actor",
        "action",
        "subject",
        "resource",
        "classification",
        "effect_count",
        "issued_at",
        "expires_at",
        "model_run_sha256",
        "justification",
    }
    _keys(data, expected, context)
    classification = _string(data["classification"], f"{context}.classification", pattern=_ID)
    if classification not in _CLASSIFICATIONS:
        raise ContractError(f"{context}.classification is unsupported")
    issued_at = _integer(
        data["issued_at"], f"{context}.issued_at", minimum=0, maximum=1_000_000_000
    )
    expires_at = _integer(
        data["expires_at"], f"{context}.expires_at", minimum=0, maximum=1_000_000_000
    )
    if expires_at <= issued_at:
        raise ContractError(f"{context}.expires_at must be greater than issued_at")
    return Proposal(
        proposal_id=_string(data["proposal_id"], f"{context}.proposal_id", pattern=_ID),
        tenant=_string(data["tenant"], f"{context}.tenant", pattern=_ID),
        actor=_string(data["actor"], f"{context}.actor", pattern=_ID),
        action=_string(data["action"], f"{context}.action", pattern=_ID),
        subject=_string(data["subject"], f"{context}.subject", pattern=_ID),
        resource=_string(data["resource"], f"{context}.resource", pattern=_ID),
        classification=classification,
        effect_count=_integer(
            data["effect_count"], f"{context}.effect_count", minimum=1, maximum=1_000
        ),
        issued_at=issued_at,
        expires_at=expires_at,
        model_run_sha256=_string(
            data["model_run_sha256"],
            f"{context}.model_run_sha256",
            maximum=64,
            pattern=_SHA256,
        ),
        justification=_string(data["justification"], f"{context}.justification", maximum=MAX_TEXT),
    )


def _event(value: Any, index: int) -> Event:
    context = f"events[{index}]"
    data = _object(value, context)
    kind = _string(data.get("kind"), f"{context}.kind", pattern=_ID)
    at = _integer(data.get("at"), f"{context}.at", minimum=0, maximum=1_000_000_000)
    if kind == "proposal":
        _keys(data, {"kind", "at", "proposal"}, context)
        proposal = _proposal(data["proposal"], f"{context}.proposal")
        if proposal.issued_at != at:
            raise ContractError(f"{context}.at must equal proposal.issued_at")
        return ProposalEvent(at, proposal)
    if kind == "approval":
        _keys(data, {"kind", "at", "proposal_id", "actor", "decision"}, context)
        decision = _string(data["decision"], f"{context}.decision", pattern=_ID)
        if decision not in {"approve", "reject"}:
            raise ContractError(f"{context}.decision is unsupported")
        return ApprovalEvent(
            at,
            _string(data["proposal_id"], f"{context}.proposal_id", pattern=_ID),
            _string(data["actor"], f"{context}.actor", pattern=_ID),
            decision,
        )
    if kind == "execute":
        _keys(data, {"kind", "at", "proposal_id", "actor", "nonce"}, context)
        return ExecuteEvent(
            at,
            _string(data["proposal_id"], f"{context}.proposal_id", pattern=_ID),
            _string(data["actor"], f"{context}.actor", pattern=_ID),
            _string(data["nonce"], f"{context}.nonce", pattern=_ID),
        )
    raise ContractError(f"{context}.kind is unsupported")


def parse_scenario(value: Any) -> Scenario:
    data = _object(value, "scenario")
    _keys(data, {"format", "name", "principals", "events"}, "scenario")
    if data["format"] != FORMAT:
        raise ContractError("scenario.format is unsupported")
    name = _string(data["name"], "scenario.name", maximum=80)
    principals = tuple(
        _principal(item, index)
        for index, item in enumerate(
            _array(data["principals"], "scenario.principals", MAX_PRINCIPALS)
        )
    )
    principal_ids = [principal.principal_id for principal in principals]
    if len(principal_ids) != len(set(principal_ids)):
        raise ContractError("principal ids must be unique")
    events = tuple(
        _event(item, index)
        for index, item in enumerate(_array(data["events"], "scenario.events", MAX_EVENTS))
    )
    previous_at = -1
    for index, event in enumerate(events):
        if event.at < previous_at:
            raise ContractError(f"events[{index}].at must be non-decreasing")
        previous_at = event.at
    return Scenario(name, principals, events)

