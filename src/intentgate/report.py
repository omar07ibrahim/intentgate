"""Self-contained offline HTML report for a verified IntentGate artifact."""

from __future__ import annotations

import html
import os
from pathlib import Path
from typing import Any

from .verify import verify_artifact


def _escape(value: Any) -> str:
    return html.escape(str(value), quote=True)


def _short(value: str) -> str:
    return f"{value[:12]}…{value[-8:]}"


def _proposal_rows(artifact: dict[str, Any]) -> list[dict[str, str]]:
    proposals: dict[str, dict[str, str]] = {}
    for entry in artifact["entries"]:
        event = entry["event"]
        decision = entry["decision"]
        if event["kind"] == "proposal":
            proposal = event["proposal"]
            proposals[proposal["proposal_id"]] = {
                "proposal_id": proposal["proposal_id"],
                "action": proposal["action"],
                "classification": proposal["classification"],
                "state": decision["state"],
                "decision": decision["code"],
                "justification": proposal["justification"],
            }
        else:
            proposal_id = event["proposal_id"]
            if proposal_id in proposals:
                proposals[proposal_id]["state"] = decision["state"]
                proposals[proposal_id]["decision"] = decision["code"]
    return [proposals[key] for key in sorted(proposals)]


def render_report(artifact: dict[str, Any]) -> str:
    summary = verify_artifact(artifact)
    proposal_rows = _proposal_rows(artifact)
    proposals_html = "".join(
        "<tr>"
        f"<td><code>{_escape(row['proposal_id'])}</code></td>"
        f"<td>{_escape(row['action'])}</td>"
        f"<td>{_escape(row['classification'])}</td>"
        f"<td><span class='state state-{_escape(row['state'].lower())}'>{_escape(row['state'])}</span></td>"
        f"<td><code>{_escape(row['decision'])}</code></td>"
        f"<td class='justification'>{_escape(row['justification'])}</td>"
        "</tr>"
        for row in proposal_rows
    )
    ledger_html = "".join(
        "<tr>"
        f"<td>{entry['index']:02d}</td>"
        f"<td>{_escape(entry['event']['kind'])}</td>"
        f"<td><code>{_escape(entry['decision']['code'])}</code></td>"
        f"<td>{'accepted' if entry['decision']['accepted'] else 'rejected'}</td>"
        f"<td><code>{_escape(_short(entry['entry_sha256']))}</code></td>"
        "</tr>"
        for entry in artifact["entries"]
    )
    maximum = max(summary["proposals"], 1)
    bars = "".join(
        f"<div class='bar-row'><span>{label}</span><div class='track'><i style='width:{value / maximum * 100:.2f}%'></i></div><b>{value}</b></div>"
        for label, value in (
            ("Executed", summary["executed_proposals"]),
            ("Blocked", summary["blocked_proposals"]),
            ("Human rejected", summary["rejected_proposals"]),
            ("Expired", summary["expired_proposals"]),
        )
    )
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>IntentGate verified decision report</title>
<style>
:root{{--ink:#122033;--muted:#607086;--paper:#f5f7fb;--card:#fff;--navy:#122c4d;--teal:#00a6a6;--green:#11865b;--red:#bd3c4b;--amber:#b86b00;--line:#dce3ec}}
*{{box-sizing:border-box}} body{{margin:0;background:var(--paper);color:var(--ink);font:14px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}
main{{max-width:1240px;margin:0 auto;padding:32px}} .hero{{background:linear-gradient(128deg,#102946,#153c5b 60%,#0b6b70);color:white;border-radius:24px;padding:34px;box-shadow:0 18px 45px #12314c26}}
.eyebrow{{font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#92f2ea;font-weight:800}} h1{{font-size:42px;line-height:1.05;margin:10px 0 12px}} .hero p{{max-width:760px;color:#d8e9f3;font-size:16px}}
.badges{{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}} .badge{{border:1px solid #ffffff38;border-radius:999px;padding:7px 11px;background:#ffffff10}}
.grid{{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:18px 0}} .metric,.card{{background:var(--card);border:1px solid var(--line);border-radius:18px;box-shadow:0 8px 28px #24354b0c}}
.metric{{padding:20px}} .metric b{{display:block;font-size:30px;color:var(--navy)}} .metric span{{color:var(--muted)}}
.two{{display:grid;grid-template-columns:1fr 1.3fr;gap:18px;margin:18px 0}} .card{{padding:22px;overflow:hidden}} h2{{margin:0 0 14px;font-size:20px}}
.bar-row{{display:grid;grid-template-columns:115px 1fr 28px;gap:10px;align-items:center;margin:14px 0}} .track{{height:12px;background:#e8edf3;border-radius:999px;overflow:hidden}} .track i{{display:block;height:100%;background:linear-gradient(90deg,var(--teal),#56c596);border-radius:999px}}
table{{width:100%;border-collapse:collapse}} th{{text-align:left;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.07em}} th,td{{padding:11px 10px;border-bottom:1px solid #e7ecf2;vertical-align:top}} code{{font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace}}
.scroll{{overflow:auto}} .state{{font-size:11px;font-weight:800;padding:4px 7px;border-radius:999px}} .state-executed{{background:#d9f4e7;color:#096643}} .state-blocked,.state-rejected{{background:#ffe1e4;color:#9f2635}} .state-expired{{background:#fff0d4;color:#915100}}
.justification{{min-width:270px;max-width:380px;color:#405168}} .hashes{{display:grid;gap:8px}} .hashes div{{display:grid;grid-template-columns:150px 1fr;gap:12px}} .hashes code{{overflow-wrap:anywhere;color:#36536f}}
footer{{color:var(--muted);padding:14px 4px 32px}} @media(max-width:900px){{main{{padding:16px}}h1{{font-size:34px}}.grid{{grid-template-columns:repeat(2,1fr)}}.two{{grid-template-columns:1fr}}}}
@media(max-width:520px){{.hero{{padding:24px 20px}}.grid{{grid-template-columns:1fr 1fr}}.metric{{padding:14px}}.metric b{{font-size:24px}}th:nth-child(3),td:nth-child(3),th:nth-child(6),td:nth-child(6){{display:none}}}}
</style>
</head>
<body><main>
<section class="hero">
<div class="eyebrow">Verified replay · offline artifact</div>
<h1>IntentGate decision ledger</h1>
<p>Untrusted model proposals cross a deterministic policy boundary, role-specific human approval, expiry checks, and single-use execution before an effect can be committed.</p>
<div class="badges"><span class="badge">Scenario: {_escape(artifact["scenario"]["name"])}</span><span class="badge">Policy {_escape(_short(artifact["policy_sha256"]))}</span><span class="badge">Replay verified</span></div>
</section>
<section class="grid">
<div class="metric"><b>{summary["proposals"]}</b><span>bounded proposals</span></div>
<div class="metric"><b>{summary["effects"]}</b><span>committed effects</span></div>
<div class="metric"><b>{summary["rejected_events"]}</b><span>rejected events</span></div>
<div class="metric"><b>{summary["cross_tenant_effects"]}</b><span>cross-tenant effects</span></div>
</section>
<section class="two">
<div class="card"><h2>Final proposal outcomes</h2>{bars}</div>
<div class="card"><h2>Receipt chain</h2><div class="hashes">
<div><span>Scenario</span><code>{_escape(artifact["scenario_sha256"])}</code></div>
<div><span>Policy</span><code>{_escape(artifact["policy_sha256"])}</code></div>
<div><span>Ledger root</span><code>{_escape(artifact["ledger_root_sha256"])}</code></div>
<div><span>Artifact</span><code>{_escape(artifact["artifact_sha256"])}</code></div>
</div></div>
</section>
<section class="card"><h2>Proposal disposition</h2><div class="scroll"><table>
<thead><tr><th>ID</th><th>Action</th><th>Class</th><th>Final state</th><th>Last decision</th><th>Untrusted justification</th></tr></thead>
<tbody>{proposals_html}</tbody></table></div></section>
<section class="card" style="margin-top:18px"><h2>Replay ledger · {len(artifact["entries"])} transitions</h2><div class="scroll"><table>
<thead><tr><th>#</th><th>Event</th><th>Decision</th><th>Disposition</th><th>Entry SHA-256</th></tr></thead>
<tbody>{ledger_html}</tbody></table></div></section>
<footer>Synthetic HR workflow fixture. This report is evidence of deterministic replay for the checked-in scenario, not a claim about model quality, legal compliance, production IAM, or real employee data.</footer>
</main></body></html>
"""


def write_report(path: str | Path, artifact: dict[str, Any]) -> None:
    destination = Path(path)
    payload = render_report(artifact).encode("utf-8")
    temporary = destination.with_name(f".{destination.name}.tmp-{os.getpid()}")
    try:
        with temporary.open("xb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, destination)
    finally:
        try:
            temporary.unlink()
        except FileNotFoundError:
            pass
