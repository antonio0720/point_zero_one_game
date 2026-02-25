#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parents[1]  # backend/
SRC = ROOT / "src"
BACKUP = ROOT / ".backup_llm_corruption_v2"

# Match any fenced block opener/closer like ```ts, ```typescript, ```sql, ```bash, ```yaml, ```hcl, ```
FENCE_RE = re.compile(r"^\s*```(?P<lang>[A-Za-z0-9_-]+)?\s*$")

# Leading prose contamination patterns
LEADING_PROSE_PATTERNS = [
    re.compile(r"^\s*\d+\s*:\s*Here is the TypeScript file\b", re.I),
    re.compile(r"^\s*\d+\s+Here is the TypeScript file\b", re.I),
    re.compile(r"^\s*Here is the TypeScript file\b", re.I),
    re.compile(r"^\s*Here is the TypeScript file for\b", re.I),
]

# Trailing prose contamination patterns
TRAILING_PROSE_PATTERNS = [
    re.compile(r"^\s*This TypeScript file exports\b", re.I),
    re.compile(r"^\s*Regarding the SQL, YAML/JSON, and Bash files\b", re.I),
    re.compile(r"^\s*The TypeScript file provided here only covers\b", re.I),
]

# "Looks like TS code starts here"
CODE_START_PATTERNS = [
    re.compile(r"^\s*/\*\*"),
    re.compile(r"^\s*/\*"),
    re.compile(r"^\s*//"),
    re.compile(r"^\s*import\b"),
    re.compile(r"^\s*export\b"),
    re.compile(r"^\s*@\w+"),
    re.compile(r"^\s*(abstract\s+)?class\b"),
    re.compile(r"^\s*interface\b"),
    re.compile(r"^\s*type\b"),
    re.compile(r"^\s*enum\b"),
    re.compile(r"^\s*(const|let|var)\b"),
    re.compile(r"^\s*function\b"),
    re.compile(r"^\s*async\s+function\b"),
]

TS_FENCE_LANGS = {"ts", "typescript", ""}


@dataclass
class FileStats:
    changed: bool = False
    removed_leading_prose: int = 0
    removed_trailing_prose: int = 0
    removed_fence_markers: int = 0
    removed_non_ts_fenced_lines: int = 0


def is_leading_prose(line: str) -> bool:
    return any(p.search(line) for p in LEADING_PROSE_PATTERNS)


def is_trailing_prose(line: str) -> bool:
    return any(p.search(line) for p in TRAILING_PROSE_PATTERNS)


def is_code_start(line: str) -> bool:
    return any(p.search(line) for p in CODE_START_PATTERNS)


def strip_fenced_blocks(lines: list[str], stats: FileStats) -> list[str]:
    """
    Keep TypeScript fenced content, drop fence markers.
    Remove non-TypeScript fenced blocks entirely (including their contents).
    """
    out: list[str] = []
    in_fence = False
    current_fence_lang: Optional[str] = None
    keep_current_fence = False

    for line in lines:
        m = FENCE_RE.match(line)
        if m:
            lang = (m.group("lang") or "").strip().lower()

            if not in_fence:
                # opening fence
                in_fence = True
                current_fence_lang = lang
                keep_current_fence = lang in TS_FENCE_LANGS
                stats.removed_fence_markers += 1
                # always drop fence marker lines
                continue
            else:
                # closing fence
                in_fence = False
                current_fence_lang = None
                keep_current_fence = False
                stats.removed_fence_markers += 1
                continue

        if in_fence:
            if keep_current_fence:
                out.append(line)
            else:
                stats.removed_non_ts_fenced_lines += 1
            continue

        out.append(line)

    return out


def trim_leading_prose(lines: list[str], stats: FileStats) -> list[str]:
    # remove explicit prose lines first
    tmp: list[str] = []
    for line in lines:
        if is_leading_prose(line):
            stats.removed_leading_prose += 1
            continue
        tmp.append(line)

    # if prose/noise remains before actual code, trim until first code-ish line
    first_code_idx: Optional[int] = None
    for i, line in enumerate(tmp):
        if is_code_start(line):
            first_code_idx = i
            break

    if first_code_idx is not None and first_code_idx > 0:
        stats.removed_leading_prose += first_code_idx
        tmp = tmp[first_code_idx:]

    return tmp


def trim_trailing_prose(lines: list[str], stats: FileStats) -> list[str]:
    for i, line in enumerate(lines):
        if is_trailing_prose(line):
            stats.removed_trailing_prose += (len(lines) - i)
            return lines[:i]
    return lines


def trim_edge_blanks(lines: list[str]) -> list[str]:
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    return lines


def sanitize_text(text: str) -> tuple[str, FileStats]:
    stats = FileStats()
    lines = text.splitlines()

    # 1) Remove / keep fenced blocks correctly
    lines = strip_fenced_blocks(lines, stats)

    # 2) Remove leading prose contamination
    lines = trim_leading_prose(lines, stats)

    # 3) Remove trailing prose contamination
    lines = trim_trailing_prose(lines, stats)

    # 4) Remove any orphan raw prose lines that exactly match known bad starts
    cleaned: list[str] = []
    for line in lines:
        if is_leading_prose(line) or is_trailing_prose(line):
            # catch leftovers
            if is_leading_prose(line):
                stats.removed_leading_prose += 1
            else:
                stats.removed_trailing_prose += 1
            continue
        cleaned.append(line)

    # 5) Edge blank trim
    cleaned = trim_edge_blanks(cleaned)

    result = ("\n".join(cleaned) + "\n") if cleaned else ""
    return result, stats


def detect_remaining_contamination(text: str) -> list[str]:
    findings: list[str] = []
    checks = [
        ("prose_here_is", "Here is the TypeScript file"),
        ("prose_exports", "This TypeScript file exports"),
        ("prose_regarding_sql", "Regarding the SQL, YAML/JSON, and Bash files"),
        ("fence_marker", "```"),
    ]
    for key, needle in checks:
        if needle in text:
            findings.append(key)
    return findings


def main() -> int:
    if not SRC.exists():
        print(f"ERROR: src not found: {SRC}")
        return 1

    BACKUP.mkdir(parents=True, exist_ok=True)

    ts_files = sorted(SRC.rglob("*.ts"))
    total = len(ts_files)
    changed = 0
    still_bad: list[str] = []

    total_removed_fence_markers = 0
    total_removed_non_ts_fenced_lines = 0
    total_removed_leading_prose = 0
    total_removed_trailing_prose = 0

    for fp in ts_files:
        original = fp.read_text(encoding="utf-8", errors="ignore")
        cleaned, stats = sanitize_text(original)

        total_removed_fence_markers += stats.removed_fence_markers
        total_removed_non_ts_fenced_lines += stats.removed_non_ts_fenced_lines
        total_removed_leading_prose += stats.removed_leading_prose
        total_removed_trailing_prose += stats.removed_trailing_prose

        if cleaned != original:
            backup_path = BACKUP / fp.relative_to(ROOT)
            backup_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(fp, backup_path)
            fp.write_text(cleaned, encoding="utf-8")
            changed += 1

        post = fp.read_text(encoding="utf-8", errors="ignore")
        remaining = detect_remaining_contamination(post)
        if remaining:
            still_bad.append(f"{fp.relative_to(ROOT)} :: {', '.join(remaining)}")

    print(f"Scanned .ts files: {total}")
    print(f"Changed files:      {changed}")
    print(f"Backup dir:         {BACKUP}")
    print("")
    print("Removed contamination totals:")
    print(f"  fence markers:           {total_removed_fence_markers}")
    print(f"  non-TS fenced lines:     {total_removed_non_ts_fenced_lines}")
    print(f"  leading prose lines:     {total_removed_leading_prose}")
    print(f"  trailing prose lines:    {total_removed_trailing_prose}")

    if still_bad:
        print("\nStill contaminated (needs manual repair):")
        for entry in still_bad[:500]:
            print(f" - {entry}")
        if len(still_bad) > 500:
            print(f" ... and {len(still_bad) - 500} more")
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())