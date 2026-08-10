# Reproducible evidence

The files in [`docs/evidence/`](evidence/) are generated outputs, not hand-authored mockups. The workflow runs the installed CLI against the checked-in synthetic scenario, verifies the result, renders the real report, captures it in a pinned browser, and compares regenerated files byte for byte.

## Evidence set

| File | What it proves |
|---|---|
| `intentgate-run.json` | exact canonical decision artifact |
| `intentgate-report.html` | verified, self-contained report |
| `intentgate-cli.txt` | actual run/verify/inspect/report transcript |
| `intentgate-report.png` | 1440×1000 report viewport |
| `intentgate-report-full.png` | complete report page |
| `intentgate-report-mobile.png` | 390×844 responsive viewport |
| `intentgate-cli.png` | rendered real terminal transcript |
| `intentgate-demo.gif` | three distinct report positions |
| `architecture.svg` | source-generated control flow |
| `trust-boundary.svg` | source-generated boundary/invariants |
| `state-machine.svg` | source-generated terminal states |
| `outcome-funnel.svg` | graph of actual fixture outcomes |
| `intentgate-evidence.json` | source binding, hashes, dimensions, versions |

## Generation sequence

```text
scenario
  -> installed intentgate CLI
  -> canonical run.json
  -> independent replay
  -> verified offline report.html
  -> generated SVGs
  -> networkless Chromium screenshots + GIF
  -> manifest
  -> byte-for-byte drift comparison
```

The CLI/report stage uses CPython 3.14.6 and the hash-locked quality environment. Browser wheels are downloaded with `--require-hashes --only-binary=:all:`. Capture then runs inside the digest-pinned Playwright image recorded in [`evidence-browser-image.lock.json`](../requirements/evidence-browser-image.lock.json).

The browser container is:

- `linux/amd64`;
- read-only, except dedicated tmpfs/output mounts;
- network-disabled;
- capability-dropped with no-new-privileges;
- CPU, memory, process, and shared-memory bounded;
- pinned to Chromium 151.0.7922.34, Playwright 1.62.0, and Pillow 12.3.0.

## Source binding

The manifest records the source commit and tree selected by the latest change to:

- evidence workflow and capture tool;
- package metadata;
- browser and quality lockfiles;
- scenario;
- all `src/intentgate` modules.

For every source it records relative path, byte count, and SHA-256. For every evidence file it records the same plus media type and raster dimensions/frame count where applicable.

A documentation-only commit does not make valid evidence stale. A source, scenario, tool, or lockfile change does.

## Reproduce

The authoritative command is the [evidence workflow](../.github/workflows/evidence.yml). It regenerates in a clean GitHub runner and rejects any difference.

The main stages can also be invoked manually on a machine with the required Python, Docker, and pinned image:

```bash
python tools/capture_evidence.py --help
# Follow the prepare -> capture -> finalize -> verify commands in
# .github/workflows/evidence.yml with isolated temporary directories.
```

The long commands intentionally live in one reviewed workflow so platform, network, viewport, version, and file-set constraints cannot silently diverge between prose and CI.

## Privacy and authenticity checks

Text evidence is rejected if it contains common credential prefixes, private-key markers, bearer authorization text, or absolute home-directory paths. The fixture contains no real people or employee records.

PNG/GIF headers, dimensions, frame count, and visual detail are checked. SVGs must parse as XML, have a viewBox, and contain a minimum structural detail. The checked-in files are then compared byte for byte with the newly generated candidate.
