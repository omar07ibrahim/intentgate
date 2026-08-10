# Changelog

All notable changes to IntentGate are documented here. The project follows semantic versioning while pre-1.0 APIs may still evolve.

## [Unreleased]

No unreleased changes.

## [0.1.0] - 2026-08-10

### Added

- strict bounded `intentgate.scenario.v1` contract with duplicate-key, non-finite-number, UTF-8, size, item, and type checks;
- deterministic action/classification policy with tenant, role, TTL, resource-prefix, and one-effect admission rules;
- human manager/privacy approval quorum, explicit rejection, expiry, nonce replay prevention, and terminal effect states;
- canonical SHA-256 transition ledger, effect certificates, final state root, and artifact digest;
- independent replay implementation that does not import the production engine or policy;
- `run`, `verify`, `inspect`, and `report` CLI commands;
- self-contained verified HTML report with untrusted-text escaping;
- synthetic adversarial HR fixture with 10 proposals and 28 transitions;
- 72-test suite with 98.59% line coverage and Python 3.11–3.14 compatibility;
- clean-wheel consumer test, strict mypy/Ruff gates, hash-locked tooling, and full-SHA Actions;
- 13-file source-bound visual evidence bundle captured in networkless Chromium;
- architecture, threat-model, evidence, security, and contribution documentation.

### Changed

- renamed the repository from the generic `test` name to `intentgate`;
- moved the original incomplete AeroCRM snapshot under `legacy/aerocrm-2025/` without changing its original blobs.

[Unreleased]: https://github.com/omar07ibrahim/intentgate/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/omar07ibrahim/intentgate/releases/tag/v0.1.0
