"""Generate and verify source-bound IntentGate portfolio evidence."""

# ruff: noqa: E501 -- SVG, CSS, terminal HTML, and workflow contracts stay readable

from __future__ import annotations

import argparse
import hashlib
import html
import json
import platform
import struct
import xml.etree.ElementTree as ET
from collections.abc import Sequence
from io import BytesIO
from pathlib import Path
from typing import Any

FORMAT = "intentgate.evidence.v1"
EVIDENCE_DIRECTORY = Path("docs/evidence")
MANIFEST_NAME = "intentgate-evidence.json"
CONTAINER_IMAGE = (
    "mcr.microsoft.com/playwright/python@"
    "sha256:51d31fdfacb0cff99a1a724152e34ae408d2bd4e7da310ff157450f49261cc59"
)
EXPECTED_FILES = {
    "architecture.svg",
    "intentgate-cli.png",
    "intentgate-cli.txt",
    "intentgate-demo.gif",
    "intentgate-report-full.png",
    "intentgate-report-mobile.png",
    "intentgate-report.html",
    "intentgate-report.png",
    "intentgate-run.json",
    "outcome-funnel.svg",
    "state-machine.svg",
    "trust-boundary.svg",
}
MEDIA_TYPES = {
    ".gif": "image/gif",
    ".html": "text/html",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".txt": "text/plain",
}
FORBIDDEN_TEXT = (
    "/home/",
    "/Users/",
    "github_pat_",
    "gho_",
    "ghp_",
    "sk-proj-",
    "BEGIN PRIVATE KEY",
    "Authorization: Bearer",
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)

    prepare_parser = commands.add_parser("prepare")
    prepare_parser.add_argument("--root", type=Path, required=True)
    prepare_parser.add_argument("--artifact", type=Path, required=True)
    prepare_parser.add_argument("--report", type=Path, required=True)
    prepare_parser.add_argument("--cli", type=Path, required=True)
    prepare_parser.add_argument("--output-root", type=Path, required=True)

    capture_parser = commands.add_parser("capture")
    capture_parser.add_argument("--output-root", type=Path, required=True)
    capture_parser.add_argument("--container-image", required=True)

    finalize_parser = commands.add_parser("finalize")
    finalize_parser.add_argument("--root", type=Path, required=True)
    finalize_parser.add_argument("--output-root", type=Path, required=True)
    finalize_parser.add_argument("--source-revision", required=True)
    finalize_parser.add_argument("--source-tree", required=True)
    finalize_parser.add_argument("--container-image", required=True)
    finalize_parser.add_argument("--browser", required=True)
    finalize_parser.add_argument("--playwright", required=True)
    finalize_parser.add_argument("--pillow", required=True)

    verify_parser = commands.add_parser("verify")
    verify_parser.add_argument("--root", type=Path, required=True)
    verify_parser.add_argument("--output-root", type=Path, required=True)
    verify_parser.add_argument("--source-revision", required=True)
    verify_parser.add_argument("--source-tree", required=True)
    verify_parser.add_argument("--container-image", required=True)

    visual_parser = commands.add_parser("verify-visuals")
    visual_parser.add_argument("--output-root", type=Path, required=True)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    arguments = build_parser().parse_args(argv)
    if arguments.command == "prepare":
        prepare(
            arguments.root,
            arguments.artifact,
            arguments.report,
            arguments.cli,
            arguments.output_root,
        )
    elif arguments.command == "capture":
        capture(arguments.output_root, arguments.container_image)
    elif arguments.command == "finalize":
        finalize(
            arguments.root,
            arguments.output_root,
            arguments.source_revision,
            arguments.source_tree,
            arguments.container_image,
            arguments.browser,
            arguments.playwright,
            arguments.pillow,
        )
    elif arguments.command == "verify":
        verify(
            arguments.root,
            arguments.output_root,
            arguments.source_revision,
            arguments.source_tree,
            arguments.container_image,
        )
    else:
        verify_visuals(arguments.output_root)
    return 0


def prepare(
    root: Path,
    artifact_path: Path,
    report_path: Path,
    cli_path: Path,
    output_root: Path,
) -> None:
    root = root.resolve()
    if output_root.exists():
        raise ValueError("evidence output root already exists")
    evidence = output_root / EVIDENCE_DIRECTORY
    evidence.mkdir(parents=True)

    from intentgate.canonical import MAX_ARTIFACT_BYTES, load_json
    from intentgate.report import render_report
    from intentgate.verify import verify_artifact

    artifact = load_json(artifact_path, max_bytes=MAX_ARTIFACT_BYTES)
    if not isinstance(artifact, dict):
        raise ValueError("evidence artifact must be an object")
    summary = verify_artifact(artifact)
    report = report_path.read_text(encoding="utf-8")
    if report != render_report(artifact):
        raise ValueError("CLI report differs from verified library rendering")
    cli = cli_path.read_text(encoding="utf-8")
    _reject_sensitive_text(cli)
    if not cli.startswith("$ intentgate run scenario.json --output run.json"):
        raise ValueError("CLI transcript does not begin with the executed run command")
    if artifact["artifact_sha256"] not in cli:
        raise ValueError("CLI transcript does not expose the artifact digest")
    if f"verified {summary['events']} transitions, {summary['effects']} effects" not in cli:
        raise ValueError("CLI transcript does not contain verified replay output")

    (evidence / "intentgate-run.json").write_bytes(artifact_path.read_bytes())
    _write_text(evidence / "intentgate-report.html", report)
    _write_text(evidence / "intentgate-cli.txt", cli)
    _write_text(evidence / "architecture.svg", _architecture_svg(artifact))
    _write_text(evidence / "trust-boundary.svg", _trust_boundary_svg(artifact))
    _write_text(evidence / "state-machine.svg", _state_machine_svg(artifact))
    _write_text(evidence / "outcome-funnel.svg", _outcome_svg(artifact))

    for source in _source_paths(root):
        if not source.is_file():
            raise ValueError(f"missing evidence source: {source.relative_to(root)}")


def capture(output_root: Path, container_image: str) -> None:
    from PIL import Image
    from playwright.sync_api import sync_playwright

    if container_image != CONTAINER_IMAGE:
        raise ValueError("capture image does not match the reviewed platform manifest")
    evidence = output_root / EVIDENCE_DIRECTORY
    report = (evidence / "intentgate-report.html").resolve()
    cli = (evidence / "intentgate-cli.txt").read_text(encoding="utf-8")
    _reject_sensitive_text(cli)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(args=["--disable-gpu"])
        if browser.version != "151.0.7922.34":
            raise ValueError(f"unexpected Chromium version: {browser.version}")

        desktop = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
        desktop.goto(report.as_uri(), wait_until="load")
        desktop.locator("h1").wait_for()
        desktop.screenshot(path=evidence / "intentgate-report.png", animations="disabled")
        desktop.screenshot(
            path=evidence / "intentgate-report-full.png",
            full_page=True,
            animations="disabled",
        )

        mobile = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        mobile.goto(report.as_uri(), wait_until="load")
        mobile.locator("h1").wait_for()
        overflow = mobile.evaluate(
            """() => ({
                viewport: window.innerWidth,
                scrollWidth: document.documentElement.scrollWidth,
                bodyWidth: document.body.scrollWidth,
            })"""
        )
        if overflow["scrollWidth"] > overflow["viewport"] + 1:
            raise ValueError(f"mobile report has horizontal overflow: {overflow}")
        mobile.screenshot(path=evidence / "intentgate-report-mobile.png", animations="disabled")
        mobile.close()

        demo = browser.new_page(viewport={"width": 1120, "height": 820}, device_scale_factor=1)
        demo.goto(report.as_uri(), wait_until="load")
        frames = [demo.screenshot(animations="disabled")]
        demo.get_by_role("heading", name="Final proposal outcomes").scroll_into_view_if_needed()
        frames.append(demo.screenshot(animations="disabled"))
        demo.locator("h2").filter(has_text="Replay ledger").scroll_into_view_if_needed()
        frames.append(demo.screenshot(animations="disabled"))
        images = [
            Image.open(BytesIO(frame)).convert("P", palette=Image.Palette.ADAPTIVE, colors=128)
            for frame in frames
        ]
        images[0].save(
            evidence / "intentgate-demo.gif",
            save_all=True,
            append_images=images[1:],
            duration=[1_100, 1_200, 1_600],
            loop=0,
            disposal=2,
            optimize=False,
        )
        demo.close()

        terminal = browser.new_page(viewport={"width": 1180, "height": 650}, device_scale_factor=1)
        terminal.set_content(_terminal_html(cli), wait_until="load")
        terminal.locator("pre").wait_for()
        terminal.screenshot(path=evidence / "intentgate-cli.png", animations="disabled")
        terminal.close()
        desktop.close()
        browser.close()


def finalize(
    root: Path,
    output_root: Path,
    source_revision: str,
    source_tree: str,
    container_image: str,
    browser: str,
    playwright: str,
    pillow: str,
) -> None:
    _validate_oid(source_revision, "source revision")
    _validate_oid(source_tree, "source tree")
    if container_image != CONTAINER_IMAGE:
        raise ValueError("unexpected evidence container")
    evidence = output_root / EVIDENCE_DIRECTORY
    actual = {path.name for path in evidence.iterdir() if path.is_file()}
    if actual != EXPECTED_FILES:
        raise ValueError(
            f"evidence files differ before finalization: {sorted(actual ^ EXPECTED_FILES)}"
        )

    from intentgate.canonical import MAX_ARTIFACT_BYTES, load_json
    from intentgate.verify import verify_artifact

    artifact = load_json(evidence / "intentgate-run.json", max_bytes=MAX_ARTIFACT_BYTES)
    if not isinstance(artifact, dict):
        raise ValueError("evidence artifact must be an object")
    summary = verify_artifact(artifact)
    sources = [_file_record(path, root) for path in _source_paths(root)]
    files = [_evidence_record(path, output_root) for path in sorted(evidence.iterdir())]
    manifest: dict[str, Any] = {
        "format": FORMAT,
        "source_revision": source_revision,
        "source_tree": source_tree,
        "scenario_sha256": artifact["scenario_sha256"],
        "policy_sha256": artifact["policy_sha256"],
        "ledger_root_sha256": artifact["ledger_root_sha256"],
        "artifact_sha256": artifact["artifact_sha256"],
        "result": _result(summary),
        "generation": {
            "python": platform.python_version(),
            "implementation": platform.python_implementation(),
            "browser": browser,
            "playwright": playwright,
            "pillow": pillow,
            "container_image": container_image,
            "platform": "linux/amd64",
            "network": "disabled during browser capture",
            "viewports": {
                "desktop": [1440, 1000],
                "mobile": [390, 844],
                "demo": [1120, 820],
                "terminal": [1180, 650],
            },
        },
        "sources": sources,
        "files": files,
    }
    _write_text(
        evidence / MANIFEST_NAME,
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
    )


def verify(
    root: Path,
    output_root: Path,
    source_revision: str,
    source_tree: str,
    container_image: str,
) -> None:
    _validate_oid(source_revision, "source revision")
    _validate_oid(source_tree, "source tree")
    evidence = output_root / EVIDENCE_DIRECTORY
    actual = {path.name for path in evidence.iterdir() if path.is_file()}
    expected = EXPECTED_FILES | {MANIFEST_NAME}
    if actual != expected:
        raise ValueError(f"evidence file set differs: {sorted(actual ^ expected)}")
    manifest = json.loads((evidence / MANIFEST_NAME).read_text(encoding="utf-8"))
    if manifest["format"] != FORMAT:
        raise ValueError("evidence format mismatch")
    if manifest["source_revision"] != source_revision or manifest["source_tree"] != source_tree:
        raise ValueError("evidence source binding mismatch")
    if manifest["generation"]["container_image"] != container_image:
        raise ValueError("evidence container mismatch")
    if manifest["generation"]["python"] != "3.14.6":
        raise ValueError("evidence Python runtime mismatch")
    expected_sources = [_file_record(path, root) for path in _source_paths(root)]
    if manifest["sources"] != expected_sources:
        raise ValueError("evidence source hashes differ")
    expected_files = [
        _evidence_record(path, output_root)
        for path in sorted(evidence.iterdir())
        if path.name != MANIFEST_NAME
    ]
    if manifest["files"] != expected_files:
        raise ValueError("evidence file hashes or dimensions differ")

    from intentgate.canonical import MAX_ARTIFACT_BYTES, load_json
    from intentgate.report import render_report
    from intentgate.verify import verify_artifact

    artifact = load_json(evidence / "intentgate-run.json", max_bytes=MAX_ARTIFACT_BYTES)
    if not isinstance(artifact, dict):
        raise ValueError("evidence artifact must be an object")
    summary = verify_artifact(artifact)
    if (evidence / "intentgate-report.html").read_text(encoding="utf-8") != render_report(artifact):
        raise ValueError("checked-in report does not replay")
    if manifest["result"] != _result(summary):
        raise ValueError("manifest result does not match the replay")
    for key in (
        "scenario_sha256",
        "policy_sha256",
        "ledger_root_sha256",
        "artifact_sha256",
    ):
        if manifest[key] != artifact[key]:
            raise ValueError(f"manifest {key} mismatch")

    for path in evidence.iterdir():
        if path.suffix in {".html", ".json", ".svg", ".txt"}:
            _reject_sensitive_text(path.read_text(encoding="utf-8"))
        if path.suffix == ".svg":
            _verify_svg(path)


def verify_visuals(output_root: Path) -> None:
    from PIL import Image, ImageSequence

    evidence = output_root / EVIDENCE_DIRECTORY
    expected_png = {
        "intentgate-report.png": (1440, 1000),
        "intentgate-report-mobile.png": (390, 844),
        "intentgate-cli.png": (1180, 650),
    }
    for name, dimensions in expected_png.items():
        with Image.open(evidence / name) as image:
            if image.format != "PNG" or image.size != dimensions:
                raise ValueError(
                    f"unexpected raster contract for {name}: {image.format} {image.size}"
                )
            _reject_blank_image(image, name)
    with Image.open(evidence / "intentgate-report-full.png") as image:
        if image.format != "PNG" or image.width != 1440 or image.height < 1_800:
            raise ValueError(f"unexpected full-page raster: {image.format} {image.size}")
        _reject_blank_image(image, "intentgate-report-full.png")
    with Image.open(evidence / "intentgate-demo.gif") as image:
        frames = list(ImageSequence.Iterator(image))
        if image.format != "GIF" or image.size != (1120, 820) or len(frames) != 3:
            raise ValueError(f"unexpected GIF contract: {image.format} {image.size} {len(frames)}")
        for index, frame in enumerate(frames):
            _reject_blank_image(frame, f"intentgate-demo.gif frame {index}")


def _reject_blank_image(image: Any, label: str) -> None:
    converted = image.convert("RGB")
    extrema = converted.getextrema()
    if all(low == high for low, high in extrema):
        raise ValueError(f"blank evidence image: {label}")
    colors = converted.resize((160, 100)).getcolors(maxcolors=20_000)
    if colors is None or len(colors) < 12:
        raise ValueError(f"insufficient visual detail: {label}")


def _result(summary: dict[str, int]) -> dict[str, int]:
    keys = (
        "proposals",
        "admitted_proposals",
        "blocked_proposals",
        "executed_proposals",
        "rejected_proposals",
        "expired_proposals",
        "events",
        "accepted_events",
        "rejected_events",
        "effects",
        "duplicate_effects",
        "cross_tenant_effects",
    )
    return {key: summary[key] for key in keys}


def _architecture_svg(artifact: dict[str, Any]) -> str:
    summary = artifact["summary"]
    labels = (
        ("01", "UNTRUSTED MODEL", "Proposal text + bounded action"),
        ("02", "STRICT CONTRACT", "Types, size, time, one effect"),
        ("03", "POLICY GATE", "Action + classification matrix"),
        ("04", "HUMAN QUORUM", "Manager / privacy as required"),
        ("05", "EXECUTION", f"{summary['effects']} certified effects"),
    )
    boxes = "".join(
        f"""<g transform="translate({55 + index * 225} 180)">
<rect width="190" height="190" rx="24" fill="#13283f" stroke="{"#e85d75" if index == 0 else "#35c2ba"}" stroke-width="2"/>
<text x="20" y="34" fill="#7ee7df" font-size="13" font-weight="700">{number}</text>
<text x="20" y="76" fill="#ffffff" font-size="15" font-weight="800">{title}</text>
<text x="20" y="112" fill="#b9c9d8" font-size="12">{detail.split(" + ")[0]}</text>
<text x="20" y="134" fill="#b9c9d8" font-size="12">{detail.split(" + ")[1] if " + " in detail else ""}</text>
</g>"""
        for index, (number, title, detail) in enumerate(labels)
    )
    arrows = "".join(
        f'<path d="M {245 + index * 225} 275 H {275 + index * 225}" stroke="#7ee7df" stroke-width="3" marker-end="url(#arrow)"/>'
        for index in range(4)
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 540">
<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#07121f"/><stop offset="1" stop-color="#103b4d"/></linearGradient><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6Z" fill="#7ee7df"/></marker></defs>
<rect width="1200" height="540" rx="28" fill="url(#bg)"/>
<text x="55" y="65" fill="#7ee7df" font-size="14" font-weight="800" letter-spacing="2">INTENTGATE / VERIFIED WORKFLOW</text>
<text x="55" y="110" fill="#ffffff" font-size="32" font-weight="800">Authority is earned at deterministic boundaries</text>
{boxes}{arrows}
<text x="55" y="430" fill="#91a9bc" font-size="13">Policy {artifact["policy_sha256"][:16]}…  ·  Ledger {artifact["ledger_root_sha256"][:16]}…  ·  Independent replay verified</text>
<text x="55" y="465" fill="#d7e5ee" font-size="14">The model proposes. The gate decides. Humans authorize. The executor commits once.</text>
</svg>
"""


def _trust_boundary_svg(artifact: dict[str, Any]) -> str:
    summary = artifact["summary"]
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 560">
<rect width="1200" height="560" rx="28" fill="#f4f7fb"/>
<text x="55" y="65" fill="#102d4b" font-size="32" font-weight="800">Trust boundary and fail-closed invariants</text>
<rect x="55" y="120" width="300" height="330" rx="24" fill="#fff0f2" stroke="#d84a63" stroke-width="2"/>
<text x="85" y="165" fill="#a51f3b" font-size="18" font-weight="800">UNTRUSTED INPUT</text>
<text x="85" y="210" fill="#572b35" font-size="15">• model justification</text><text x="85" y="245" fill="#572b35" font-size="15">• requested action</text><text x="85" y="280" fill="#572b35" font-size="15">• tenant + resource</text><text x="85" y="315" fill="#572b35" font-size="15">• prompt-injection text</text>
<text x="85" y="385" fill="#a51f3b" font-size="14" font-weight="700">Never executed directly</text>
<path d="M355 285H445" stroke="#d84a63" stroke-width="4"/><path d="M430 272L450 285L430 298Z" fill="#d84a63"/>
<rect x="450" y="100" width="300" height="370" rx="24" fill="#102d4b"/>
<text x="480" y="150" fill="#7ee7df" font-size="18" font-weight="800">DETERMINISTIC GATE</text>
<text x="480" y="200" fill="#ffffff" font-size="15">Exact schema + bounds</text><text x="480" y="235" fill="#ffffff" font-size="15">Policy matrix + TTL</text><text x="480" y="270" fill="#ffffff" font-size="15">Role-specific quorum</text><text x="480" y="305" fill="#ffffff" font-size="15">Tenant isolation</text><text x="480" y="340" fill="#ffffff" font-size="15">Nonce replay defense</text><text x="480" y="375" fill="#ffffff" font-size="15">Hash-chained receipt</text>
<text x="480" y="425" fill="#7ee7df" font-size="14" font-weight="700">{summary["rejected_events"]} events rejected safely</text>
<path d="M750 285H840" stroke="#16947e" stroke-width="4"/><path d="M825 272L845 285L825 298Z" fill="#16947e"/>
<rect x="845" y="120" width="300" height="330" rx="24" fill="#e9f8f3" stroke="#16947e" stroke-width="2"/>
<text x="875" y="165" fill="#086a59" font-size="18" font-weight="800">CERTIFIED EFFECTS</text>
<text x="875" y="220" fill="#17483f" font-size="48" font-weight="800">{summary["effects"]}</text><text x="935" y="215" fill="#477269" font-size="15">effects</text>
<text x="875" y="280" fill="#17483f" font-size="15">duplicate effects: {summary["duplicate_effects"]}</text><text x="875" y="315" fill="#17483f" font-size="15">cross-tenant effects: {summary["cross_tenant_effects"]}</text>
<text x="875" y="385" fill="#086a59" font-size="14" font-weight="700">Replay independently verified</text>
</svg>
"""


def _state_machine_svg(artifact: dict[str, Any]) -> str:
    summary = artifact["summary"]
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600">
<defs><marker id="a" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6Z" fill="#54718d"/></marker></defs>
<rect width="1200" height="600" rx="28" fill="#ffffff"/>
<text x="55" y="60" fill="#102d4b" font-size="32" font-weight="800">Proposal state machine</text>
<text x="55" y="92" fill="#61758a" font-size="14">Every transition is recorded with before/after state hashes and a chained entry digest.</text>
<g font-family="system-ui,sans-serif" text-anchor="middle">
<rect x="70" y="210" width="180" height="90" rx="45" fill="#dce8f5"/><text x="160" y="264" fill="#183a5c" font-size="18" font-weight="800">PROPOSED</text>
<rect x="345" y="145" width="180" height="90" rx="45" fill="#fff0d4"/><text x="435" y="199" fill="#8b5400" font-size="18" font-weight="800">PENDING</text>
<rect x="620" y="145" width="180" height="90" rx="45" fill="#dff3ef"/><text x="710" y="199" fill="#0c6d5b" font-size="18" font-weight="800">READY</text>
<rect x="895" y="145" width="210" height="90" rx="45" fill="#d9f4e7"/><text x="1000" y="199" fill="#096643" font-size="18" font-weight="800">EXECUTED · {summary["executed_proposals"]}</text>
<rect x="345" y="365" width="180" height="90" rx="45" fill="#ffe1e4"/><text x="435" y="419" fill="#9f2635" font-size="18" font-weight="800">BLOCKED · {summary["blocked_proposals"]}</text>
<rect x="620" y="365" width="180" height="90" rx="45" fill="#ffe1e4"/><text x="710" y="419" fill="#9f2635" font-size="18" font-weight="800">REJECTED · {summary["rejected_proposals"]}</text>
<rect x="895" y="365" width="210" height="90" rx="45" fill="#fff0d4"/><text x="1000" y="419" fill="#8b5400" font-size="18" font-weight="800">EXPIRED · {summary["expired_proposals"]}</text>
</g>
<g stroke="#54718d" stroke-width="3" fill="none" marker-end="url(#a)"><path d="M250 240L345 200"/><path d="M525 190H620"/><path d="M800 190H895"/><path d="M250 275L345 385"/><path d="M525 225L655 365"/><path d="M790 225L960 365"/></g>
<g fill="#54718d" font-size="12" font-family="system-ui,sans-serif"><text x="275" y="205">admit</text><text x="555" y="175">quorum</text><text x="830" y="175">execute once</text><text x="270" y="340">fail closed</text><text x="555" y="315">human reject</text><text x="845" y="315">TTL exceeded</text></g>
<text x="55" y="540" fill="#61758a" font-size="13">Terminal states cannot be reopened; nonce reuse and second effects are rejected.</text>
</svg>
"""


def _outcome_svg(artifact: dict[str, Any]) -> str:
    summary = artifact["summary"]
    outcomes = (
        ("Executed", summary["executed_proposals"], "#16a078"),
        ("Policy blocked", summary["blocked_proposals"], "#d84a63"),
        ("Human rejected", summary["rejected_proposals"], "#9a5770"),
        ("Expired", summary["expired_proposals"], "#d28a19"),
    )
    maximum = max(value for _, value, _ in outcomes)
    bars = "".join(
        f"""<text x="70" y="{180 + index * 75}" fill="#29445f" font-size="15">{label}</text>
<rect x="245" y="{155 + index * 75}" width="680" height="34" rx="17" fill="#e8eef4"/>
<rect x="245" y="{155 + index * 75}" width="{680 * value / maximum:.1f}" height="34" rx="17" fill="{color}"/>
<text x="950" y="{180 + index * 75}" fill="#102d4b" font-size="18" font-weight="800">{value}</text>"""
        for index, (label, value, color) in enumerate(outcomes)
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 560">
<rect width="1200" height="560" rx="28" fill="#f6f8fb"/>
<text x="55" y="60" fill="#102d4b" font-size="32" font-weight="800">Verified fixture outcomes</text>
<text x="55" y="95" fill="#61758a" font-size="14">Synthetic HR adversarial workflow · {summary["proposals"]} proposals · {summary["events"]} transitions</text>
{bars}
<rect x="1010" y="145" width="135" height="250" rx="22" fill="#102d4b"/>
<text x="1077" y="190" text-anchor="middle" fill="#7ee7df" font-size="12" font-weight="800">EVENTS</text>
<text x="1077" y="250" text-anchor="middle" fill="#ffffff" font-size="38" font-weight="800">{summary["accepted_events"]}</text><text x="1077" y="275" text-anchor="middle" fill="#b8cada" font-size="12">accepted</text>
<text x="1077" y="335" text-anchor="middle" fill="#ff9aaa" font-size="38" font-weight="800">{summary["rejected_events"]}</text><text x="1077" y="360" text-anchor="middle" fill="#b8cada" font-size="12">rejected</text>
<text x="55" y="500" fill="#61758a" font-size="13">Measured from the checked-in deterministic fixture; no model-quality or production-compliance claim.</text>
</svg>
"""


def _terminal_html(cli: str) -> str:
    escaped = html.escape(cli)
    return f"""<!doctype html><meta charset="utf-8"><style>
html,body{{margin:0;background:#071019;color:#dce8f2}}body{{padding:34px;font:15px/1.48 ui-monospace,SFMono-Regular,Consolas,monospace}}
.window{{border:1px solid #294158;border-radius:18px;overflow:hidden;box-shadow:0 24px 70px #0008}}
.bar{{height:46px;background:#101e2c;border-bottom:1px solid #294158;display:flex;align-items:center;padding:0 18px;gap:9px}}
.dot{{width:12px;height:12px;border-radius:50%}}.r{{background:#ff6b6b}}.y{{background:#f4d35e}}.g{{background:#52d6a6}}
pre{{margin:0;padding:24px 28px;white-space:pre-wrap;overflow-wrap:anywhere}}b{{color:#52d6a6}}
</style><div class="window"><div class="bar"><i class="dot r"></i><i class="dot y"></i><i class="dot g"></i></div><pre>{escaped}</pre></div>"""


def _source_paths(root: Path) -> list[Path]:
    paths = [
        root / ".github/workflows/evidence.yml",
        root / "pyproject.toml",
        root / "requirements/evidence-browser-image.lock.json",
        root / "requirements/evidence-browser.txt",
        root / "requirements/quality.in",
        root / "requirements/quality.txt",
        root / "scenarios/hr-assistant.json",
        root / "tools/capture_evidence.py",
    ]
    paths.extend(sorted((root / "src/intentgate").glob("*.py")))
    paths.append(root / "src/intentgate/py.typed")
    return paths


def _file_record(path: Path, root: Path) -> dict[str, Any]:
    data = path.read_bytes()
    return {
        "path": path.relative_to(root).as_posix(),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }


def _evidence_record(path: Path, root: Path) -> dict[str, Any]:
    record = _file_record(path, root)
    record["media_type"] = MEDIA_TYPES[path.suffix]
    if path.suffix == ".png":
        record["dimensions"] = list(_png_dimensions(path))
    elif path.suffix == ".gif":
        record["dimensions"] = list(_gif_dimensions(path))
        record["frames"] = 3
    return record


def _png_dimensions(path: Path) -> tuple[int, int]:
    data = path.read_bytes()[:24]
    if len(data) != 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"invalid PNG: {path}")
    return struct.unpack(">II", data[16:24])


def _gif_dimensions(path: Path) -> tuple[int, int]:
    data = path.read_bytes()[:10]
    if len(data) != 10 or data[:6] not in {b"GIF87a", b"GIF89a"}:
        raise ValueError(f"invalid GIF: {path}")
    return struct.unpack("<HH", data[6:10])


def _validate_oid(value: str, label: str) -> None:
    if len(value) != 40 or any(character not in "0123456789abcdef" for character in value):
        raise ValueError(f"invalid {label}")


def _verify_svg(path: Path) -> None:
    root = ET.parse(path).getroot()
    if not root.tag.endswith("svg") or root.get("viewBox") is None:
        raise ValueError(f"invalid SVG structure: {path}")
    if len(list(root.iter())) < 8:
        raise ValueError(f"SVG lacks detail: {path}")


def _reject_sensitive_text(value: str) -> None:
    for marker in FORBIDDEN_TEXT:
        if marker in value:
            raise ValueError(f"evidence contains forbidden marker: {marker}")


def _write_text(path: Path, value: str) -> None:
    path.write_text(value, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    raise SystemExit(main())
