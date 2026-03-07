#!/usr/bin/env python3
"""
PZO File Audit — scans listed files for placeholder/stub patterns.
Run from repo root:
  python3 scripts/pzo/audit_stubs.py
"""

import os
import re
import sys
import json

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

FILES_TO_AUDIT = [
    "backend/src/licensing_control_plane/benchmarks/scoring_engine.ts",
    "backend/src/services/integrity_public/audit/public_audit_ledger.ts",
    "backend/src/licensing_control_plane/rosters/roster_importer.ts",
    "backend/src/services/anti_spam_scoring/anti_spam_scoring_impl.ts",
    "backend/src/observability/metrics_partner_distribution.ts",
    "backend/src/security/explorer_lookup_hardening.ts",
    "backend/src/game/modes/household_mode.ts",
    "backend/src/security/receipt_ledger_integrity.ts",
    "backend/src/jobs/streak_reconciliation_job.ts",
    "backend/src/services/referrals/index.ts",
    "backend/src/services/admin/season0_admin/season0_admin_impl.ts",
    "backend/src/services/loss_is_content/forks/fork_creator.ts",
    "backend/src/services/content/card_authoring_api.ts",
    "backend/src/services/remote_config/cohort_targeting.ts",
    "backend/src/services/after_autopsy/after_autopsy_impl.ts",
    "backend/src/services/partners/cohorts/index.ts",
    "backend/src/services/creator_economy/creator_service.ts",
    "backend/src/services/telemetry/ingest/batching.ts",
]

# Patterns that indicate stub/placeholder code
STUB_PATTERNS = [
    (r"//\s*TODO", "TODO comment"),
    (r"//\s*FIXME", "FIXME comment"),
    (r"//\s*HACK", "HACK comment"),
    (r"//\s*XXX", "XXX comment"),
    (r"//\s*PLACEHOLDER", "PLACEHOLDER comment"),
    (r"//\s*STUB", "STUB comment"),
    (r"throw new Error\(['\"]Not implemented", "Not implemented throw"),
    (r"throw new Error\(['\"]TODO", "TODO throw"),
    (r"console\.log\(['\"]TODO", "TODO console.log"),
    (r"return\s*;\s*//", "Empty return with comment"),
    (r"^\s*//\s*Implement\s", "Implement comment"),
    (r"^\s*//\s*implement\s", "implement comment"),
    (r"^\s*//\s*Add\s+logic", "Add logic comment"),
    (r"^\s*//\s*add\s+logic", "add logic comment"),
    (r"^\s*//\s*Handle\s", "Handle comment (stub)"),
    (r"^\s*//\s*Replace\s+this", "Replace this comment"),
    (r"^\s*//\s*Wire\s", "Wire comment (stub)"),
    (r"res\.send\(\s*/\*", "res.send(/* ... */) placeholder"),
    (r"res\.json\(\s*\{\s*\}\s*\)", "res.json({}) empty response"),
    (r"async\s+\([^)]*\)\s*=>\s*\{\s*\}", "Empty async arrow function"),
    (r"=>\s*\{\s*\}", "Empty arrow function body"),
    (r"\{\s*\}\s*\)", "Empty function body"),
]

# Patterns for plain English text masquerading as code
PLAIN_ENGLISH_PATTERNS = [
    (r"^\s*[A-Z][a-z]+\s+[a-z]+\s+[a-z]+\s+[a-z]+\s+[a-z]+", "Looks like plain English sentence"),
    (r"^\s*This\s+(file|module|service|function|class)", "Descriptive sentence, not code"),
    (r"^\s*The\s+(following|above|below)", "Descriptive sentence, not code"),
    (r"^\s*Here\s+(is|are|we)", "Descriptive sentence, not code"),
    (r"^\s*We\s+(need|should|will|can)", "Descriptive sentence, not code"),
    (r"^\s*You\s+(should|need|can|will)", "Descriptive sentence, not code"),
]

# Function patterns — check if function bodies are empty or stubs
EMPTY_FUNCTION_RE = re.compile(
    r"(?:export\s+)?(?:async\s+)?function\s+\w+\s*\([^)]*\)[^{]*\{\s*\}",
    re.MULTILINE
)

EMPTY_METHOD_RE = re.compile(
    r"(?:public|private|protected|static|async)\s+\w+\s*\([^)]*\)[^{]*\{\s*\}",
    re.MULTILINE
)

def count_code_lines(content: str) -> int:
    """Count non-empty, non-comment lines."""
    count = 0
    for line in content.split('\n'):
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith('//'):
            continue
        if stripped.startswith('/*') or stripped.startswith('*') or stripped.startswith('*/'):
            continue
        if stripped.startswith('import ') or stripped.startswith('export '):
            continue
        count += 1
    return count

def audit_file(filepath: str) -> dict:
    """Audit a single file for stub/placeholder patterns."""
    full_path = os.path.join(REPO_ROOT, filepath)
    result = {
        "file": filepath,
        "exists": False,
        "size_bytes": 0,
        "total_lines": 0,
        "code_lines": 0,
        "issues": [],
        "severity": "OK",
    }

    if not os.path.exists(full_path):
        result["issues"].append({"line": 0, "type": "MISSING", "detail": "File does not exist"})
        result["severity"] = "CRITICAL"
        return result

    result["exists"] = True
    result["size_bytes"] = os.path.getsize(full_path)

    with open(full_path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    lines = content.split('\n')
    result["total_lines"] = len(lines)
    result["code_lines"] = count_code_lines(content)

    # Check if file is very small (likely a stub)
    if result["code_lines"] < 5 and result["total_lines"] > 0:
        result["issues"].append({
            "line": 0, "type": "TINY_FILE",
            "detail": f"Only {result['code_lines']} code lines — likely a stub"
        })

    # Check for stub patterns
    for i, line in enumerate(lines, 1):
        for pattern, label in STUB_PATTERNS:
            if re.search(pattern, line):
                result["issues"].append({
                    "line": i, "type": "STUB",
                    "detail": f"{label}: {line.strip()[:120]}"
                })

    # Check for plain English lines (not in comments)
    in_block_comment = False
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if '/*' in stripped:
            in_block_comment = True
        if '*/' in stripped:
            in_block_comment = False
            continue
        if in_block_comment or stripped.startswith('//') or stripped.startswith('*'):
            continue
        if not stripped or stripped.startswith('import') or stripped.startswith('export'):
            continue
        for pattern, label in PLAIN_ENGLISH_PATTERNS:
            if re.search(pattern, stripped):
                result["issues"].append({
                    "line": i, "type": "PLAIN_ENGLISH",
                    "detail": f"{label}: {stripped[:120]}"
                })

    # Check for empty functions
    for match in EMPTY_FUNCTION_RE.finditer(content):
        line_num = content[:match.start()].count('\n') + 1
        result["issues"].append({
            "line": line_num, "type": "EMPTY_FUNCTION",
            "detail": f"Empty function body: {match.group()[:100]}"
        })

    for match in EMPTY_METHOD_RE.finditer(content):
        line_num = content[:match.start()].count('\n') + 1
        result["issues"].append({
            "line": line_num, "type": "EMPTY_METHOD",
            "detail": f"Empty method body: {match.group()[:100]}"
        })

    # Check for files that are mostly comments
    comment_lines = sum(1 for l in lines if l.strip().startswith('//') or l.strip().startswith('*') or l.strip().startswith('/*'))
    if result["total_lines"] > 10 and comment_lines > result["total_lines"] * 0.7:
        result["issues"].append({
            "line": 0, "type": "MOSTLY_COMMENTS",
            "detail": f"{comment_lines}/{result['total_lines']} lines are comments — likely a spec doc, not implementation"
        })

    # Check for 'any' type usage (code quality)
    any_count = len(re.findall(r':\s*any\b', content))
    if any_count > 5:
        result["issues"].append({
            "line": 0, "type": "EXCESSIVE_ANY",
            "detail": f"{any_count} uses of 'any' type"
        })

    # Determine severity
    issue_types = set(i["type"] for i in result["issues"])
    if "MISSING" in issue_types:
        result["severity"] = "CRITICAL"
    elif "PLAIN_ENGLISH" in issue_types or "MOSTLY_COMMENTS" in issue_types:
        result["severity"] = "CRITICAL"
    elif "EMPTY_FUNCTION" in issue_types or "EMPTY_METHOD" in issue_types or "TINY_FILE" in issue_types:
        result["severity"] = "HIGH"
    elif "STUB" in issue_types:
        result["severity"] = "MEDIUM"
    elif result["issues"]:
        result["severity"] = "LOW"

    return result


def main():
    print("=" * 80)
    print("PZO STUB AUDIT — Scanning files for placeholders, stubs, plain English")
    print("=" * 80)
    print(f"Repo root: {REPO_ROOT}")
    print(f"Files to audit: {len(FILES_TO_AUDIT)}")
    print()

    results = []
    for filepath in FILES_TO_AUDIT:
        result = audit_file(filepath)
        results.append(result)

    # Sort by severity
    severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "OK": 4}
    results.sort(key=lambda r: severity_order.get(r["severity"], 5))

    # Print results
    for r in results:
        icon = {"CRITICAL": "🔴", "HIGH": "🟠", "MEDIUM": "🟡", "LOW": "🟢", "OK": "✅"}.get(r["severity"], "❓")
        print(f"{icon} [{r['severity']}] {r['file']}")
        if r["exists"]:
            print(f"   Size: {r['size_bytes']} bytes | Lines: {r['total_lines']} | Code lines: {r['code_lines']}")
        for issue in r["issues"]:
            line_str = f"L{issue['line']}" if issue['line'] > 0 else "   "
            print(f"   {line_str} [{issue['type']}] {issue['detail']}")
        print()

    # Summary
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    critical = sum(1 for r in results if r["severity"] == "CRITICAL")
    high = sum(1 for r in results if r["severity"] == "HIGH")
    medium = sum(1 for r in results if r["severity"] == "MEDIUM")
    low = sum(1 for r in results if r["severity"] == "LOW")
    ok_count = sum(1 for r in results if r["severity"] == "OK")
    total_issues = sum(len(r["issues"]) for r in results)

    print(f"  🔴 CRITICAL: {critical}")
    print(f"  🟠 HIGH:     {high}")
    print(f"  🟡 MEDIUM:   {medium}")
    print(f"  🟢 LOW:      {low}")
    print(f"  ✅ OK:       {ok_count}")
    print(f"  Total issues: {total_issues}")
    print()

    # Print the full content of critical/high files for diagnosis
    print("=" * 80)
    print("FULL CONTENT OF CRITICAL/HIGH FILES (for diagnosis)")
    print("=" * 80)
    for r in results:
        if r["severity"] not in ("CRITICAL", "HIGH"):
            continue
        if not r["exists"]:
            print(f"\n--- {r['file']} --- [MISSING]\n")
            continue
        full_path = os.path.join(REPO_ROOT, r["file"])
        with open(full_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        print(f"\n--- {r['file']} --- ({r['total_lines']} lines, {r['size_bytes']} bytes)")
        # Print first 150 lines max
        lines = content.split('\n')
        for i, line in enumerate(lines[:150], 1):
            print(f"  {i:4d} | {line}")
        if len(lines) > 150:
            print(f"  ... ({len(lines) - 150} more lines)")
        print()

    # Exit with error code if critical/high issues found
    if critical > 0 or high > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
