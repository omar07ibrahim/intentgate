from __future__ import annotations

import copy
from typing import Any, cast

import pytest

from intentgate.engine import run_scenario
from intentgate.model import parse_scenario
from intentgate.verify import verify_artifact

EXPECTED_SUMMARY = {
    "proposals": 10,
    "admitted_proposals": 6,
    "blocked_proposals": 4,
    "executed_proposals": 4,
    "rejected_proposals": 1,
    "expired_proposals": 1,
    "pending_proposals": 0,
    "events": 28,
    "accepted_events": 17,
    "rejected_events": 11,
    "accepted_approvals": 7,
    "effects": 4,
    "duplicate_effects": 0,
    "cross_tenant_effects": 0,
}


def _run(
    scenario_data: dict[str, Any],
    events: list[dict[str, Any]],
    *,
    principals: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    value = {
        "format": "intentgate.scenario.v1",
        "name": "Focused safety contract",
        "principals": copy.deepcopy(
            scenario_data["principals"] if principals is None else principals
        ),
        "events": copy.deepcopy(events),
    }
    artifact = run_scenario(parse_scenario(value))
    assert verify_artifact(artifact) == artifact["summary"]
    return artifact


def _proposal(
    scenario_data: dict[str, Any],
    *,
    proposal_id: str = "p-case",
    action: str = "leave.approve",
    classification: str = "internal",
    resource: str = "leave:case",
) -> dict[str, Any]:
    event = cast(dict[str, Any], copy.deepcopy(scenario_data["events"][0]))
    event["proposal"]["proposal_id"] = proposal_id
    event["proposal"]["action"] = action
    event["proposal"]["classification"] = classification
    event["proposal"]["resource"] = resource
    event["proposal"]["issued_at"] = 1
    event["proposal"]["expires_at"] = 20
    event["at"] = 1
    return event


def _approval(
    proposal_id: str,
    actor: str,
    *,
    at: int = 2,
    decision: str = "approve",
) -> dict[str, Any]:
    return {
        "kind": "approval",
        "at": at,
        "proposal_id": proposal_id,
        "actor": actor,
        "decision": decision,
    }


def _execute(
    proposal_id: str,
    actor: str,
    *,
    at: int = 3,
    nonce: str = "nonce:case",
) -> dict[str, Any]:
    return {
        "kind": "execute",
        "at": at,
        "proposal_id": proposal_id,
        "actor": actor,
        "nonce": nonce,
    }


def test_reference_scenario_has_stable_receipts(artifact: dict[str, Any]) -> None:
    assert artifact["summary"] == EXPECTED_SUMMARY
    assert artifact["scenario_sha256"] == (
        "a84aace36715b61bee6167fc598979bafc21224b9054391a7e94f1de853d47e7"
    )
    assert artifact["policy_sha256"] == (
        "f0133da74d38e85b6bddf84bdafb65e3b161e5e0954c61d511955a4392948de4"
    )
    assert artifact["ledger_root_sha256"] == (
        "ac6316c40750e20b8119d7fa53fd2424cbcb6a2dc99500ffd26e208301c8cb15"
    )
    assert artifact["artifact_sha256"] == (
        "06dba310181739ebb8cdaec02828115de8dd757ef3752128db1204dd6604298e"
    )
    assert verify_artifact(artifact) == EXPECTED_SUMMARY


def test_reference_scenario_exercises_fail_closed_decisions(
    artifact: dict[str, Any],
) -> None:
    codes = [entry["decision"]["code"] for entry in artifact["entries"]]
    assert codes == [
        "proposal_admitted",
        "approval_quorum_met",
        "effect_committed",
        "replay_nonce",
        "proposal_admitted",
        "approval_recorded",
        "cross_tenant_approver",
        "approval_quorum_met",
        "effect_committed",
        "cross_tenant_model_actor",
        "execution_invalid_state",
        "restricted_classification",
        "effect_count_exceeded",
        "proposal_admitted",
        "approver_role_not_required",
        "approval_quorum_missing",
        "approval_quorum_met",
        "effect_committed",
        "proposal_admitted",
        "approval_quorum_met",
        "proposal_expired",
        "proposal_admitted",
        "approval_quorum_met",
        "effect_committed",
        "unsupported_action",
        "proposal_admitted",
        "proposal_rejected",
        "execution_invalid_state",
    ]
    assert len({effect["proposal_id"] for effect in artifact["effects"]}) == 4
    assert {effect["tenant"] for effect in artifact["effects"]} == {"northwind"}


@pytest.mark.parametrize(
    ("case", "code"),
    [
        ("unknown-model", "unknown_model_actor"),
        ("not-model", "actor_not_model"),
        ("cross-tenant", "cross_tenant_model_actor"),
        ("effect-count", "effect_count_exceeded"),
        ("ttl", "ttl_exceeded"),
        ("action", "unsupported_action"),
        ("classification", "classification_not_allowed"),
        ("subject", "invalid_subject"),
        ("resource", "invalid_resource"),
        ("restricted", "restricted_classification"),
    ],
)
def test_admission_policy_fails_closed(
    scenario_data: dict[str, Any],
    case: str,
    code: str,
) -> None:
    event = _proposal(scenario_data)
    proposal = event["proposal"]
    if case == "unknown-model":
        proposal["actor"] = "model:missing"
    elif case == "not-model":
        proposal["actor"] = "human:liam"
    elif case == "cross-tenant":
        proposal["actor"] = "model:other-copilot"
    elif case == "effect-count":
        proposal["effect_count"] = 2
    elif case == "ttl":
        proposal["expires_at"] = 32
    elif case == "action":
        proposal["action"] = "payroll.export"
    elif case == "classification":
        proposal["classification"] = "public"
    elif case == "subject":
        proposal["subject"] = "document:case"
    elif case == "resource":
        proposal["resource"] = "employee:case"
    else:
        proposal["action"] = "document.share"
        proposal["classification"] = "restricted"
        proposal["resource"] = "document:case"
    artifact = _run(scenario_data, [event])
    assert artifact["entries"][0]["decision"] == {
        "accepted": False,
        "code": code,
        "state": "BLOCKED",
        "required_roles": [],
    }


def test_duplicate_and_missing_proposals_are_rejected(
    scenario_data: dict[str, Any],
) -> None:
    first = _proposal(scenario_data)
    duplicate = _proposal(scenario_data)
    duplicate["at"] = 2
    duplicate["proposal"]["issued_at"] = 2
    artifact = _run(
        scenario_data,
        [
            first,
            duplicate,
            _approval("p-missing", "human:maya", at=3),
            _execute("p-missing", "system:executor", at=4),
        ],
    )
    assert [entry["decision"]["code"] for entry in artifact["entries"][1:]] == [
        "duplicate_proposal",
        "unknown_proposal",
        "unknown_proposal",
    ]


def test_approval_state_and_identity_guards(
    scenario_data: dict[str, Any],
) -> None:
    public = _proposal(
        scenario_data,
        proposal_id="p-public",
        action="document.share",
        classification="public",
        resource="document:public",
    )
    blocked = _proposal(scenario_data, proposal_id="p-blocked")
    blocked["at"] = 3
    blocked["proposal"]["issued_at"] = 3
    blocked["proposal"]["actor"] = "model:missing"
    pending = _proposal(scenario_data, proposal_id="p-pending")
    pending["at"] = 5
    pending["proposal"]["issued_at"] = 5
    artifact = _run(
        scenario_data,
        [
            public,
            _approval("p-public", "human:maya"),
            blocked,
            _approval("p-blocked", "human:maya", at=4),
            pending,
            _approval("p-pending", "human:missing", at=6),
        ],
    )
    assert [entry["decision"]["code"] for entry in artifact["entries"]] == [
        "proposal_admitted",
        "approval_quorum_already_met",
        "unknown_model_actor",
        "approval_invalid_state",
        "proposal_admitted",
        "unknown_approver",
    ]


def test_duplicate_actor_and_duplicate_role_approvals(
    scenario_data: dict[str, Any],
) -> None:
    confidential = _proposal(
        scenario_data,
        action="document.share",
        classification="confidential",
        resource="document:case",
    )
    principals = copy.deepcopy(scenario_data["principals"])
    principals.append({"id": "human:other-manager", "tenant": "northwind", "role": "manager"})
    artifact = _run(
        scenario_data,
        [
            confidential,
            _approval("p-case", "human:maya"),
            _approval("p-case", "human:maya", at=3),
            _approval("p-case", "human:other-manager", at=4),
        ],
        principals=principals,
    )
    assert [entry["decision"]["code"] for entry in artifact["entries"]] == [
        "proposal_admitted",
        "approval_recorded",
        "duplicate_approval",
        "role_already_approved",
    ]


@pytest.mark.parametrize(
    ("actor", "code"),
    [
        ("system:missing", "unknown_executor"),
        ("human:maya", "actor_not_executor"),
        ("system:other-executor", "cross_tenant_executor"),
    ],
)
def test_executor_identity_guards(
    scenario_data: dict[str, Any],
    actor: str,
    code: str,
) -> None:
    proposal = _proposal(
        scenario_data,
        action="document.share",
        classification="public",
        resource="document:case",
    )
    artifact = _run(scenario_data, [proposal, _execute("p-case", actor)])
    assert artifact["entries"][-1]["decision"]["code"] == code
    assert artifact["effects"] == []


def test_executed_proposal_cannot_commit_a_second_effect(
    scenario_data: dict[str, Any],
) -> None:
    proposal = _proposal(
        scenario_data,
        action="document.share",
        classification="public",
        resource="document:case",
    )
    artifact = _run(
        scenario_data,
        [
            proposal,
            _execute("p-case", "system:executor"),
            _execute("p-case", "system:executor", at=4, nonce="nonce:second"),
        ],
    )
    assert artifact["entries"][-1]["decision"]["code"] == "execution_invalid_state"
    assert artifact["summary"]["effects"] == 1
    assert artifact["summary"]["duplicate_effects"] == 0
