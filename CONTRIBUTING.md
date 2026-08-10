# Contributing

IntentGate favors small, reviewable changes with an explicit safety invariant and reproducible evidence.

## Development setup

Use CPython 3.11–3.14. The authoritative quality environment is hash locked:

```bash
python -m venv .venv
. .venv/bin/activate
python -m pip install --no-deps --require-hashes -r requirements/quality.txt
python -m pip install --no-build-isolation --no-deps .
```

Run the full local contract:

```bash
python -m ruff check .
python -m ruff format --check .
python -m mypy
python tools/capture_evidence.py --help >/dev/null
python -m pytest -q --cov=intentgate --cov-report=term-missing --cov-fail-under=90
```

CI additionally runs the test suite on exact Python 3.11.15, 3.12.13, 3.13.14, and 3.14.6 versions, builds a wheel, inspects its contents, and exercises the installed CLI outside the checkout.

## Change requirements

- Add a focused test for every changed state transition, contract rule, or tamper condition.
- Keep runtime code dependency-free unless the architecture case is compelling.
- Preserve exact JSON bounds and fail-closed behavior.
- Maintain independence between the production engine/policy and the replay implementation.
- Use synthetic fixtures only.
- Do not weaken the claim boundary in documentation.
- Do not manually edit generated files under `docs/evidence/`.

If source, scenario, report, lockfile, workflow, or capture logic changes, regenerate evidence through the reviewed bootstrap/evidence workflow and inspect the resulting images.

## Pull requests

A useful pull request explains:

1. the invariant or user outcome being changed;
2. the threat or failure case;
3. tests that would fail without the change;
4. any artifact-format or compatibility impact;
5. whether evidence and documentation changed.

Keep commits single-purpose and do not combine unrelated refactors with policy changes.

## Generated evidence

[`.github/workflows/evidence.yml`](.github/workflows/evidence.yml) is the source of truth for regeneration. It uses a digest-pinned browser image and networkless capture. See [the evidence method](docs/evidence-method.md) before changing visual output.

## Historical snapshot

Do not “repair” `legacy/aerocrm-2025/` in place. It is a preserved, unsupported snapshot. A maintained feature belongs in the IntentGate package or a clearly separate project.
