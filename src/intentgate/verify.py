"""Independent artifact replay that does not import the production engine or policy."""

from __future__ import annotations

from typing import Any

from .canonical import sha256_data
from .errors import ContractError, VerificationError
from .model import ApprovalEvent, Event, ExecuteEvent, Principal, ProposalEvent, parse_scenario

_ARTIFACT_FORMAT = "intentgate.run.v1"
_ZERO_SHA256 = "0" * 64
_MAX_TTL = 30
_RULES: dict[str, dict[str, tuple[str, ...]]] = {
    "leave.approve": {"internal": ("manager",)},
    "document.share": {
        "public": (),
        "internal": ("manager",),
        "confidential": ("manager", "privacy"),
    },
    "profile.update": {"internal": ("manager",)},
}
_PREFIX = {
    "leave.approve": "leave:",
    "document.share": "document:",
    "profile.update": "employee:",
}


def _policy_data() -> dict[str, Any]:
    return {
        "format": "intentgate.policy.v1",
        "max_ttl": _MAX_TTL,
        "max_effect_count": 1,
        "rules": {
            action: {
                classification: list(roles)
                for classification, roles in sorted(classifications.items())
            }
            for action, classifications in sorted(_RULES.items())
        },
        "resource_prefix": dict(sorted(_PREFIX.items())),
    }


def _decision(
    accepted: bool,
    code: str,
    state: str,
    *,
    required_roles: list[str] | None = None,
    effect_sha256: str | None = None,
    certificate_sha256: str | None = None,
) -> dict[str, Any]:
    result: dict[str, Any] = {"accepted": accepted, "code": code, "state": state}
    if required_roles is not None:
        result["required_roles"] = required_roles
    if effect_sha256 is not None:
        result["effect_sha256"] = effect_sha256
    if certificate_sha256 is not None:
        result["certificate_sha256"] = certificate_sha256
    return result


def _reference_admission(
    event: ProposalEvent,
    principals: dict[str, Principal],
) -> tuple[bool, str, tuple[str, ...]]:
    proposal = event.proposal
    actor = principals.get(proposal.actor)
    if actor is None:
        return False, "unknown_model_actor", ()
    if actor.role != "model":
        return False, "actor_not_model", ()
    if actor.tenant != proposal.tenant:
        return False, "cross_tenant_model_actor", ()
    if proposal.effect_count != 1:
        return False, "effect_count_exceeded", ()
    if proposal.expires_at - proposal.issued_at > _MAX_TTL:
        return False, "ttl_exceeded", ()
    classifications = _RULES.get(proposal.action)
    if classifications is None:
        return False, "unsupported_action", ()
    roles = classifications.get(proposal.classification)
    if roles is None:
        code = (
            "restricted_classification"
            if proposal.classification == "restricted"
            else "classification_not_allowed"
        )
        return False, code, ()
    if not proposal.subject.startswith("employee:"):
        return False, "invalid_subject", ()
    if not proposal.resource.startswith(_PREFIX[proposal.action]):
        return False, "invalid_resource", ()
    return True, "proposal_admitted", roles


def _reference_proposal(
    state: dict[str, Any],
    event: ProposalEvent,
    principals: dict[str, Principal],
) -> dict[str, Any]:
    proposal = event.proposal
    if proposal.proposal_id in state["proposals"]:
        return _decision(
            False,
            "duplicate_proposal",
            state["proposals"][proposal.proposal_id]["status"],
        )
    accepted, code, roles = _reference_admission(event, principals)
    status = "BLOCKED"
    if accepted:
        status = "READY" if not roles else "PENDING"
    state["proposals"][proposal.proposal_id] = {
        "proposal": proposal.to_data(),
        "proposal_sha256": sha256_data(proposal.to_data()),
        "policy_code": code,
        "required_roles": list(roles),
        "approvals": {},
        "status": status,
    }
    return _decision(accepted, code, status, required_roles=list(roles))


def _reference_approval(
    state: dict[str, Any],
    event: ApprovalEvent,
    principals: dict[str, Principal],
) -> dict[str, Any]:
    record = state["proposals"].get(event.proposal_id)
    if record is None:
        return _decision(False, "unknown_proposal", "MISSING")
    status = record["status"]
    if status not in {"PENDING", "READY"}:
        return _decision(False, "approval_invalid_state", status)
    proposal = record["proposal"]
    if event.at > proposal["expires_at"]:
        record["status"] = "EXPIRED"
        return _decision(False, "proposal_expired", "EXPIRED")
    if status == "READY":
        return _decision(False, "approval_quorum_already_met", status)
    actor = principals.get(event.actor)
    if actor is None:
        return _decision(False, "unknown_approver", status)
    if actor.tenant != proposal["tenant"]:
        return _decision(False, "cross_tenant_approver", status)
    if actor.role not in record["required_roles"]:
        return _decision(False, "approver_role_not_required", status)
    if event.actor in record["approvals"].values():
        return _decision(False, "duplicate_approval", status)
    if actor.role in record["approvals"]:
        return _decision(False, "role_already_approved", status)
    if event.decision == "reject":
        record["status"] = "REJECTED"
        record["rejected_by"] = event.actor
        return _decision(True, "proposal_rejected", "REJECTED")
    record["approvals"][actor.role] = event.actor
    missing = [role for role in record["required_roles"] if role not in record["approvals"]]
    if missing:
        return _decision(True, "approval_recorded", "PENDING", required_roles=missing)
    record["status"] = "READY"
    return _decision(True, "approval_quorum_met", "READY", required_roles=[])


def _reference_execute(
    state: dict[str, Any],
    event: ExecuteEvent,
    principals: dict[str, Principal],
    policy_sha256: str,
) -> dict[str, Any]:
    record = state["proposals"].get(event.proposal_id)
    if record is None:
        return _decision(False, "unknown_proposal", "MISSING")
    if event.nonce in state["used_nonces"]:
        return _decision(False, "replay_nonce", record["status"])
    proposal = record["proposal"]
    actor = principals.get(event.actor)
    if actor is None:
        return _decision(False, "unknown_executor", record["status"])
    if actor.role != "executor":
        return _decision(False, "actor_not_executor", record["status"])
    if actor.tenant != proposal["tenant"]:
        return _decision(False, "cross_tenant_executor", record["status"])
    if record["status"] in {"BLOCKED", "REJECTED", "EXPIRED", "EXECUTED"}:
        return _decision(False, "execution_invalid_state", record["status"])
    if event.at > proposal["expires_at"]:
        record["status"] = "EXPIRED"
        return _decision(False, "proposal_expired", "EXPIRED")
    if record["status"] != "READY":
        return _decision(False, "approval_quorum_missing", record["status"])
    certificate = {
        "proposal_sha256": record["proposal_sha256"],
        "policy_sha256": policy_sha256,
        "required_roles": record["required_roles"],
        "approvals": record["approvals"],
    }
    certificate_sha256 = sha256_data(certificate)
    effect_payload = {
        "effect_id": f"effect:{event.proposal_id}",
        "proposal_id": event.proposal_id,
        "tenant": proposal["tenant"],
        "action": proposal["action"],
        "subject": proposal["subject"],
        "resource": proposal["resource"],
        "executed_at": event.at,
        "executor": event.actor,
        "nonce": event.nonce,
        "certificate_sha256": certificate_sha256,
    }
    effect = {**effect_payload, "effect_sha256": sha256_data(effect_payload)}
    state["used_nonces"].append(event.nonce)
    state["effects"].append(effect)
    record["status"] = "EXECUTED"
    record["effect_sha256"] = effect["effect_sha256"]
    return _decision(
        True,
        "effect_committed",
        "EXECUTED",
        effect_sha256=effect["effect_sha256"],
        certificate_sha256=certificate_sha256,
    )


def _reference_apply(
    state: dict[str, Any],
    event: Event,
    principals: dict[str, Principal],
    policy_sha256: str,
) -> dict[str, Any]:
    if isinstance(event, ProposalEvent):
        return _reference_proposal(state, event, principals)
    if isinstance(event, ApprovalEvent):
        return _reference_approval(state, event, principals)
    return _reference_execute(state, event, principals, policy_sha256)


def _reference_summary(
    state: dict[str, Any],
    entries: list[dict[str, Any]],
    principals: dict[str, Principal],
) -> dict[str, int]:
    records = list(state["proposals"].values())
    effects = state["effects"]
    return {
        "proposals": len(records),
        "admitted_proposals": sum(
            record["policy_code"] == "proposal_admitted" for record in records
        ),
        "blocked_proposals": sum(record["status"] == "BLOCKED" for record in records),
        "executed_proposals": sum(record["status"] == "EXECUTED" for record in records),
        "rejected_proposals": sum(record["status"] == "REJECTED" for record in records),
        "expired_proposals": sum(record["status"] == "EXPIRED" for record in records),
        "pending_proposals": sum(record["status"] in {"PENDING", "READY"} for record in records),
        "events": len(entries),
        "accepted_events": sum(entry["decision"]["accepted"] for entry in entries),
        "rejected_events": sum(not entry["decision"]["accepted"] for entry in entries),
        "accepted_approvals": sum(
            entry["event"]["kind"] == "approval" and entry["decision"]["accepted"]
            for entry in entries
        ),
        "effects": len(effects),
        "duplicate_effects": len(effects) - len({effect["proposal_id"] for effect in effects}),
        "cross_tenant_effects": sum(
            principals[effect["executor"]].tenant != effect["tenant"] for effect in effects
        ),
    }


def _verify(value: Any) -> dict[str, int]:
    if not isinstance(value, dict):
        raise VerificationError("artifact must be an object")
    expected_keys = {
        "format",
        "scenario",
        "scenario_sha256",
        "policy",
        "policy_sha256",
        "entries",
        "effects",
        "summary",
        "final_state_sha256",
        "ledger_root_sha256",
        "artifact_sha256",
    }
    if set(value) != expected_keys:
        raise VerificationError("artifact keys do not match the v1 contract")
    if value["format"] != _ARTIFACT_FORMAT:
        raise VerificationError("artifact format is unsupported")
    unsigned = dict(value)
    artifact_sha256 = unsigned.pop("artifact_sha256")
    if artifact_sha256 != sha256_data(unsigned):
        raise VerificationError("artifact digest mismatch")
    scenario = parse_scenario(value["scenario"])
    scenario_data = scenario.to_data()
    if value["scenario"] != scenario_data:
        raise VerificationError("scenario is not in normalized form")
    if value["scenario_sha256"] != sha256_data(scenario_data):
        raise VerificationError("scenario digest mismatch")
    expected_policy = _policy_data()
    if value["policy"] != expected_policy:
        raise VerificationError("policy contract mismatch")
    policy_sha256 = sha256_data(expected_policy)
    if value["policy_sha256"] != policy_sha256:
        raise VerificationError("policy digest mismatch")
    entries = value["entries"]
    if not isinstance(entries, list) or len(entries) != len(scenario.events):
        raise VerificationError("ledger entry count mismatch")
    principals = {principal.principal_id: principal for principal in scenario.principals}
    state: dict[str, Any] = {"proposals": {}, "used_nonces": [], "effects": []}
    replayed_entries: list[dict[str, Any]] = []
    previous = _ZERO_SHA256
    entry_keys = {
        "index",
        "event",
        "event_sha256",
        "decision",
        "before_state_sha256",
        "after_state_sha256",
        "previous_entry_sha256",
        "entry_sha256",
    }
    for index, (event, actual) in enumerate(zip(scenario.events, entries, strict=True)):
        if not isinstance(actual, dict) or set(actual) != entry_keys:
            raise VerificationError(f"ledger entry {index} has invalid keys")
        before = sha256_data(state)
        decision = _reference_apply(state, event, principals, policy_sha256)
        after = sha256_data(state)
        payload = {
            "index": index,
            "event": event.to_data(),
            "event_sha256": sha256_data(event.to_data()),
            "decision": decision,
            "before_state_sha256": before,
            "after_state_sha256": after,
            "previous_entry_sha256": previous,
        }
        entry_sha256 = sha256_data(payload)
        expected = {**payload, "entry_sha256": entry_sha256}
        if actual != expected:
            raise VerificationError(f"ledger entry {index} replay mismatch")
        replayed_entries.append(expected)
        previous = entry_sha256
    if value["effects"] != state["effects"]:
        raise VerificationError("effect list mismatch")
    summary = _reference_summary(state, replayed_entries, principals)
    if value["summary"] != summary:
        raise VerificationError("summary mismatch")
    if value["final_state_sha256"] != sha256_data(state):
        raise VerificationError("final state digest mismatch")
    if value["ledger_root_sha256"] != previous:
        raise VerificationError("ledger root mismatch")
    return summary


def verify_artifact(value: Any) -> dict[str, int]:
    try:
        return _verify(value)
    except VerificationError:
        raise
    except (ContractError, KeyError, TypeError, ValueError, RecursionError) as error:
        raise VerificationError("artifact violates the replay contract") from error
