# IntentGate

**Deterministic admission control, human approval, and independently verifiable receipts for untrusted AI action proposals.**

[![CI](https://github.com/omar07ibrahim/intentgate/actions/workflows/ci.yml/badge.svg)](https://github.com/omar07ibrahim/intentgate/actions/workflows/ci.yml)
[![Evidence](https://github.com/omar07ibrahim/intentgate/actions/workflows/evidence.yml/badge.svg)](https://github.com/omar07ibrahim/intentgate/actions/workflows/evidence.yml)
[![Python 3.11–3.14](https://img.shields.io/badge/Python-3.11%E2%80%933.14-163B57)](pyproject.toml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-0B7A75)](LICENSE)

<p align="center">
  <a href="docs/evidence/intentgate-report.html">
    <img src="docs/evidence/intentgate-report.png" alt="Real IntentGate verified decision report showing 10 proposals, 4 committed effects, 11 rejected events, and zero cross-tenant effects" width="100%">
  </a>
</p>

A model can suggest a business action. It should not inherit authority to execute one.

IntentGate treats model output as hostile input. A proposal must pass a strict bounded contract, a deterministic policy matrix, tenant checks, expiry, any required human-role quorum, and single-use execution. Every transition enters a canonical SHA-256 chain. A second implementation then replays the artifact without importing the production engine or policy.

The project is deliberately dependency-free at runtime. It does not call an LLM, hold credentials, connect to production IAM, or process real employee data.

## See the complete workflow

<p align="center">
  <img src="docs/evidence/intentgate-demo.gif" alt="Real three-frame IntentGate demo moving through the verified report, proposal disposition, and replay ledger" width="88%">
</p>

The checked-in adversarial HR fixture is synthetic and deterministic:

| Verified fixture result | Value |
|---|---:|
| Proposals | 10 |
| Admitted / policy-blocked | 6 / 4 |
| Final outcomes: executed / human-rejected / expired | 4 / 1 / 1 |
| Events accepted / rejected | 17 / 11 |
| Duplicate effects | **0** |
| Cross-tenant effects | **0** |
| Ledger transitions independently replayed | 28 |

These are fixture results, not a model-quality benchmark, legal-compliance claim, or production-readiness claim. The exact artifact is [checked in](docs/evidence/intentgate-run.json), and its [offline report](docs/evidence/intentgate-report.html) verifies before rendering.

## Architecture

<p align="center">
  <img src="docs/evidence/architecture.svg" alt="IntentGate architecture from untrusted proposal through contract, deterministic policy, human quorum, and single-use effect" width="100%">
</p>

| Boundary | What it enforces | Failure behavior |
|---|---|---|
| Contract parser | exact keys and types, strict UTF-8/JSON, unique keys, bounded bytes/items/text, monotonic time | reject input |
| Admission policy | known action, allowed classification, one effect, TTL ≤ 30, actor/tenant/resource constraints | record a terminal `BLOCKED` proposal |
| Human quorum | exact required roles, same tenant, one principal per role, explicit reject | remain pending or become terminal `REJECTED` |
| Executor | executor role, same tenant, readiness, expiry, single-use nonce | no effect |
| Ledger | event, decision, before/after state, previous entry digest | verifier rejects artifact |
| Independent replay | normalized scenario, embedded policy, every transition, effects, summary, roots | no report or verified result |

The key design choice is separation: [`engine.py`](src/intentgate/engine.py) and [`policy.py`](src/intentgate/policy.py) produce the artifact, while [`verify.py`](src/intentgate/verify.py) contains an independent reference policy and transition implementation. Shared code is limited to the strict data contract and canonical hashing.

<table>
<tr>
<td width="50%"><img src="docs/evidence/trust-boundary.svg" alt="IntentGate trust boundary and fail-closed invariants"></td>
<td width="50%"><img src="docs/evidence/state-machine.svg" alt="IntentGate proposal state machine"></td>
</tr>
<tr>
<td align="center"><strong>Trust boundary</strong></td>
<td align="center"><strong>Terminal-state machine</strong></td>
</tr>
</table>

Read the deeper [architecture](docs/architecture.md) and [threat model](docs/threat-model.md).

## Quick start

IntentGate supports CPython 3.11 through 3.14.

```bash
git clone https://github.com/omar07ibrahim/intentgate.git
cd intentgate
python -m venv .venv
. .venv/bin/activate
python -m pip install .
```

Run the checked-in scenario, independently verify it, inspect the summary, and create the offline report:

```bash
intentgate run scenarios/hr-assistant.json --output intentgate-run.json
intentgate verify intentgate-run.json
intentgate inspect intentgate-run.json
intentgate report intentgate-run.json --output intentgate-report.html
```

Expected receipt anchors for this exact fixture:

```text
scenario_sha256: a84aace36715b61bee6167fc598979bafc21224b9054391a7e94f1de853d47e7
policy_sha256:   f0133da74d38e85b6bddf84bdafb65e3b161e5e0954c61d511955a4392948de4
ledger_root:     ac6316c40750e20b8119d7fa53fd2424cbcb6a2dc99500ffd26e208301c8cb15
artifact_sha256: 06dba310181739ebb8cdaec02828115de8dd757ef3752128db1204dd6604298e
```

<p align="center">
  <img src="docs/evidence/intentgate-cli.png" alt="Actual IntentGate CLI run, verify, inspect, and report output" width="100%">
</p>

## Why the ledger is useful

A normal audit log says what one implementation claims happened. IntentGate's artifact is stronger:

1. The scenario and policy are embedded in normalized form and hashed.
2. Each ledger entry binds the event, decision, before-state hash, after-state hash, and prior entry hash.
3. An effect binds the proposal digest, policy digest, exact approvals, executor, and nonce.
4. The final artifact binds the full chain, effects, summary, and state root.
5. The independent verifier reconstructs every decision and refuses a mismatch before any report is rendered.

Tampering with a decision and recomputing only the outer artifact hash still fails replay. Tests cover forged entries, policies, effects, summaries, roots, malformed contracts, cross-tenant actors, duplicate approvals, nonce replay, expiry, and second-effect attempts.

## Real evidence, not mockups

<p align="center">
  <img src="docs/evidence/outcome-funnel.svg" alt="Measured outcomes from the checked-in IntentGate fixture" width="92%">
</p>

The repository contains 13 source-bound evidence files:

- actual desktop, full-page, mobile, and CLI PNG captures;
- a real three-frame GIF of the generated report;
- four data-backed SVG architecture/outcome diagrams;
- the exact run JSON, self-contained HTML report, and CLI transcript;
- a manifest with source commit/tree, SHA-256, byte sizes, media types, raster dimensions, tool versions, and generation constraints.

Capture uses a digest-pinned Playwright image, Chromium 151, hash-locked wheels, and a read-only container with network disabled. CI regenerates every artifact and compares every byte. See the [evidence method](docs/evidence-method.md) and [manifest](docs/evidence/intentgate-evidence.json).

<table>
<tr>
<td width="66%"><img src="docs/evidence/intentgate-report-full.png" alt="Full-page real IntentGate report"></td>
<td width="34%"><img src="docs/evidence/intentgate-report-mobile.png" alt="Real IntentGate mobile report at 390 by 844"></td>
</tr>
</table>

## Quality contract

The latest portfolio build enforces:

- 72 tests with **98.59% line coverage**;
- strict mypy and Ruff lint/format checks;
- exact CPython 3.11.15, 3.12.13, 3.13.14, and 3.14.6 compatibility jobs;
- a clean wheel build and install exercised outside the checkout;
- full-SHA pinned GitHub Actions;
- byte-for-byte visual evidence drift detection.

For the locked development workflow:

```bash
python -m pip install --no-deps --require-hashes -r requirements/quality.txt
python -m pip install --no-build-isolation --no-deps .
python -m ruff check .
python -m ruff format --check .
python -m mypy
python -m pytest -q --cov=intentgate --cov-report=term-missing
```

## Scope and non-goals

IntentGate is a reference control-plane kernel, not an authorization server.

It demonstrates deterministic policy admission, human-role approvals, tenant isolation, replay defense, canonical receipts, independent verification, and reproducible evidence. A production integration still needs authenticated identities, durable transactional storage, external authorization, key management, concurrency control, observability, retention policy, privacy review, and organization-specific policy/legal approval.

## Repository map

```text
src/intentgate/          strict contract, engine, policy, ledger, verifier, CLI, report
scenarios/               synthetic adversarial fixture
tests/                   contract, policy, replay, CLI, report, and tamper tests
tools/capture_evidence.py reproducible visual-evidence generator and verifier
docs/evidence/           real source-bound outputs and manifest
legacy/aerocrm-2025/     preserved incomplete historical snapshot
```

The original AeroCRM files were preserved under [`legacy/aerocrm-2025/`](legacy/aerocrm-2025/README.md) with their blob contents unchanged. That snapshot is historical, incomplete, and excluded from the package and quality claims.

## Documentation

- [Architecture and receipt construction](docs/architecture.md)
- [Threat model and claim boundary](docs/threat-model.md)
- [Evidence generation and verification](docs/evidence-method.md)
- [Security policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

Apache-2.0 © Omar Ibrahim.
