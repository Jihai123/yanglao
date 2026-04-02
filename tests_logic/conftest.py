from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

_LOGIC_RESULTS: list[dict] = []


def _safe_repr(value):
    try:
        return repr(value)
    except Exception:  # pragma: no cover
        return "<unreprable>"


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item: pytest.Item, call: pytest.CallInfo):
    outcome = yield
    report = outcome.get_result()

    if report.when != "call":
        return
    if "tests_logic" not in str(item.fspath):
        return

    case_data = {}
    if hasattr(item, "callspec"):
        case_data = {k: _safe_repr(v) for k, v in item.callspec.params.items()}

    _LOGIC_RESULTS.append(
        {
            "nodeid": item.nodeid,
            "outcome": report.outcome,
            "duration_sec": round(report.duration, 6),
            "case_data": case_data,
            "error": str(report.longrepr) if report.failed else "",
        }
    )


def pytest_sessionfinish(session: pytest.Session, exitstatus: int):
    reports_dir = Path("test-artifacts/reports")
    reports_dir.mkdir(parents=True, exist_ok=True)

    summary = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "exitstatus": exitstatus,
        "total": len(_LOGIC_RESULTS),
        "passed": sum(1 for r in _LOGIC_RESULTS if r["outcome"] == "passed"),
        "failed": sum(1 for r in _LOGIC_RESULTS if r["outcome"] == "failed"),
        "skipped": sum(1 for r in _LOGIC_RESULTS if r["outcome"] == "skipped"),
    }

    json_path = reports_dir / "logic-case-results.json"
    json_path.write_text(
        json.dumps({"summary": summary, "cases": _LOGIC_RESULTS}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    md_path = reports_dir / "logic-case-results.md"
    lines = [
        "# Logic Test Detailed Results",
        "",
        f"- Generated at (UTC): {summary['generated_at_utc']}",
        f"- Exit status: {summary['exitstatus']}",
        f"- Total: {summary['total']}",
        f"- Passed: {summary['passed']}",
        f"- Failed: {summary['failed']}",
        f"- Skipped: {summary['skipped']}",
        "",
        "## Case List",
        "",
        "| # | Outcome | NodeID | Case Data |",
        "|---|---|---|---|",
    ]

    for idx, row in enumerate(_LOGIC_RESULTS, 1):
        case_text = "<br>".join(f"{k}={v}" for k, v in row["case_data"].items()) or "-"
        lines.append(f"| {idx} | {row['outcome']} | `{row['nodeid']}` | {case_text} |")

    failed = [r for r in _LOGIC_RESULTS if r["outcome"] == "failed" and r["error"]]
    if failed:
        lines.extend(["", "## Failure Details", ""])
        for row in failed:
            lines.extend([f"### `{row['nodeid']}`", "```", row["error"], "```", ""])

    md_path.write_text("\n".join(lines), encoding="utf-8")
