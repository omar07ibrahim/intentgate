"""IntentGate state machine and artifact construction."""

from __future__ import annotations

from typing import Any

from .canonical import sha256_data
from .ledger import ZERO_SHA256, make_entry, state_sha256
from .model import ApprovalEvent, Event, ExecuteEvent, Principal, ProposalEvent, Scenario
from .policy import evaluate_proposal, policy_data

ARTIFACT_FORMAT = "intentgate.run.v1"


def _decision(
    accepted: bool,
    code: str,
    state: str,
    *,
    required_roles: list[str] | None = None,
    effect_sha256: str | None = None,
    certificate_sha256: str | None = None,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "accepted": accepted,
        "code": code,
        "state": state,
    }
    if required_roles is not None:
        result["required_roles"] = required_roles
    if effect_sha256 is not None:
        result["effect_sha256"] = effect_sha256
    if certificate_sha256 is not None:
        result["certificate_sha256"] = certificate_sha256
    return result


def _apply_proposal(
    state: dict[str, Any],
    event: ProposalEvent,
    principals: dict[str, Principal],
) -> dict[str, Any]:
    proposal = event.proposal
    if proposal.proposal_id in state["proposals"]:
        existing = state["proposals"][proposal.proposal_id]
        return _decision(False, "duplicate_proposal", existing["status"])
    policy = evaluate_proposal(proposal, principals)
    status = "BLOCKED"
    if policy.accepted:
        status = "READY" if not policy.required_roles else "PENDING"
    record = {
        "proposal": proposal.to_data(),
        "proposal_sha256": sha256_data(proposal.to_data()),
        "policy_code": policy.code,
        "required_roles": list(policy.required_roles),
        "approvals": {},
        "status": status,
    }
    state["proposals"][proposal.proposal_id] = record
    return _decision(
        policy.accepted,
        policy.code,
        status,
        required_roles=list(policy.required_roles),
    )


def _apply_approval(
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
    missing = [
        role for role in record["required_roles"] if role not in record["approvals"]
    ]
    if missing:
        return _decision(True, "approval_recorded", "PENDING", required_roles=missing)
    record["status"] = "READY"
    return _decision(True, "approval_quorum_met", "READY", required_roles=[])


def _apply_execute(
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


def apply_event(
    state: dict[str, Any],
    event: Event,
    principals: dict[str, Principal],
    policy_sha256: str,
) -> dict[str, Any]:
    if isinstance(event, ProposalEvent):
        return _apply_proposal(state, event, principals)
    if isinstance(event, ApprovalEvent):
        return _apply_approval(state, event, principals)
    return _apply_execute(state, event, principals, policy_sha256)


def summarize(
    state: dict[str, Any],
    entries: list[dict[str, Any]],
    principals: dict[str, Principal],
) -> dict[str, int]:
    records = list(state["proposals"].values())
    effects = state["effects"]
    cross_tenant_effects = sum(
        principals[effect["executor"]].tenant != effect["tenant"]
        for effect in effects
    )
    return {
        "proposals": len(records),
        "admitted_proposals": sum(
            record["policy_code"] == "proposal_admitted" for record in records
        ),
        "blocked_proposals": sum(record["status"] == "BLOCKED" for record in records),
        "executed_proposals": sum(record["status"] == "EXECUTED" for record in records),
        "rejected_proposals": sum(record["status"] == "REJECTED" for record in records),
        "expired_proposals": sum(record["status"] == "EXPIRED" for record in records),
        "pending_proposals": sum(
            record["status"] in {"PENDING", "READY"} for record in records
        ),
        "events": len(entries),
        "accepted_events": sum(entry["decision"]["accepted"] for entry in entries),
        "rejected_events": sum(not entry["decision"]["accepted"] for entry in entries),
        "accepted_approvals": sum(
            entry["event"]["kind"] == "approval" and entry["decision"]["accepted"]
            for entry in entries
        ),
        "effects": len(effects),
        "duplicate_effects": len(effects)
        - len({effect["proposal_id"] for effect in effects}),
        "cross_tenant_effects": cross_tenant_effects,
    }


def run_scenario(scenario: Scenario) -> dict[str, Any]:
    scenario_data = scenario.to_data()
    policy = policy_data()
    policy_sha256 = sha256_data(policy)
    principals = {principal.principal_id: principal for principal in scenario.principals}
    state: dict[str, Any] = {
        "proposals": {},
        "used_nonces": [],
        "effects": [],
    }
    entries: list[dict[str, Any]] = []
    previous = ZERO_SHA256
    for index, event in enumerate(scenario.events):
        before = state_sha256(state)
        decision = apply_event(state, event, principals, policy_sha256)
        after = state_sha256(state)
        entry = make_entry(
            index=index,
            event=event.to_data(),
            decision=decision,
            before_state_sha256=before,
            after_state_sha256=after,
            previous_entry_sha256=previous,
        )
        entries.append(entry)
        previous = entry["entry_sha256"]
    artifact = {
        "format": ARTIFACT_FORMAT,
        "scenario": scenario_data,
        "scenario_sha256": sha256_data(scenario_data),
        "policy": policy,
        "policy_sha256": policy_sha256,
        "entries": entries,
        "effects": state["effects"],
        "summary": summarize(state, entries, principals),
        "final_state_sha256": state_sha256(state),
        "ledger_root_sha256": previous,
    }
    return {**artifact, "artifact_sha256": sha256_data(artifact)}
