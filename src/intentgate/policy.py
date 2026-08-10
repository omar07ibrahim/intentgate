"""Deterministic admission policy for untrusted proposals."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .model import Principal, Proposal

MAX_TTL = 30

_RULES: dict[str, dict[str, tuple[str, ...]]] = {
    "leave.approve": {
        "internal": ("manager",),
    },
    "document.share": {
        "public": (),
        "internal": ("manager",),
        "confidential": ("manager", "privacy"),
    },
    "profile.update": {
        "internal": ("manager",),
    },
}

_RESOURCE_PREFIX = {
    "leave.approve": "leave:",
    "document.share": "document:",
    "profile.update": "employee:",
}


@dataclass(frozen=True, slots=True)
class PolicyDecision:
    accepted: bool
    code: str
    required_roles: tuple[str, ...]


def policy_data() -> dict[str, Any]:
    return {
        "format": "intentgate.policy.v1",
        "max_ttl": MAX_TTL,
        "max_effect_count": 1,
        "rules": {
            action: {
                classification: list(roles)
                for classification, roles in sorted(classifications.items())
            }
            for action, classifications in sorted(_RULES.items())
        },
        "resource_prefix": dict(sorted(_RESOURCE_PREFIX.items())),
    }


def evaluate_proposal(
    proposal: Proposal,
    principals: dict[str, Principal],
) -> PolicyDecision:
    actor = principals.get(proposal.actor)
    if actor is None:
        return PolicyDecision(False, "unknown_model_actor", ())
    if actor.role != "model":
        return PolicyDecision(False, "actor_not_model", ())
    if actor.tenant != proposal.tenant:
        return PolicyDecision(False, "cross_tenant_model_actor", ())
    if proposal.effect_count != 1:
        return PolicyDecision(False, "effect_count_exceeded", ())
    if proposal.expires_at - proposal.issued_at > MAX_TTL:
        return PolicyDecision(False, "ttl_exceeded", ())
    classifications = _RULES.get(proposal.action)
    if classifications is None:
        return PolicyDecision(False, "unsupported_action", ())
    roles = classifications.get(proposal.classification)
    if roles is None:
        if proposal.classification == "restricted":
            return PolicyDecision(False, "restricted_classification", ())
        return PolicyDecision(False, "classification_not_allowed", ())
    if not proposal.subject.startswith("employee:"):
        return PolicyDecision(False, "invalid_subject", ())
    if not proposal.resource.startswith(_RESOURCE_PREFIX[proposal.action]):
        return PolicyDecision(False, "invalid_resource", ())
    return PolicyDecision(True, "proposal_admitted", roles)
