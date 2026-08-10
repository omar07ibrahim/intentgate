# Security policy

## Supported version

IntentGate is pre-1.0 software. Security fixes are applied to the latest release and the default branch.

| Version | Supported |
|---|---|
| 0.1.x | Yes |
| Historical AeroCRM snapshot | No |

The files under `legacy/aerocrm-2025/` are preserved historical material. They are incomplete, excluded from the package, and not supported for deployment.

## Report a vulnerability

Please use [GitHub private vulnerability reporting](https://github.com/omar07ibrahim/intentgate/security/advisories/new). Do not open a public issue for a suspected vulnerability and do not include credentials, private data, or exploit details in public discussions.

Include, when possible:

- affected commit or version;
- minimal reproduction using synthetic data;
- security impact and trust-boundary assumptions;
- whether the issue affects the engine, independent verifier, artifact integrity, report escaping, packaging, or CI/evidence pipeline;
- a suggested remediation if known.

## Security boundary

IntentGate is a deterministic reference kernel. It does not provide production authentication, durable transactions, cryptographic signatures, IAM administration, or legal/compliance guarantees. Those limits are detailed in the [threat model](docs/threat-model.md).

A report is still welcome when a documented invariant can be bypassed in the checked implementation, including:

- an unauthorized, duplicate, expired, or cross-tenant effect;
- approval quorum bypass;
- accepted nonce replay;
- artifact tampering accepted by independent replay;
- unescaped active content in the offline report;
- ambiguous or unbounded input accepted by the strict contract;
- a secret or personal-data disclosure in code, history, Actions, or evidence.

## Handling secrets

The repository must not contain API keys, tokens, credentials, real employee data, or private identifiers. The evidence verifier scans text outputs for common sensitive markers. If a secret is ever committed, revocation/rotation is required even after code removal because Git history and caches may retain it.
