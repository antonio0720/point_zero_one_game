#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parents[1]  # backend/
SRC = ROOT / "src"
BACKUP = ROOT / ".backup_llm_corruption_v4"

FENCE_RE = re.compile(r"^\s*(?:\d+\s*:\s*)?```(?P<lang>[A-Za-z0-9_-]+)?\s*$")
TS_FENCE_LANGS = {"", "ts", "typescript"}

# Expanded prose signatures (raw assistant narration accidentally inserted into .ts)
PROSE_START_PATTERNS = [
    r"Here is the TypeScript file\b",
    r"Here is the TypeScript file for\b",
    r"This TypeScript file exports\b",
    r"This TypeScript file includes\b",
    r"This code defines\b",
    r"Please note that\b",
    r"Regarding SQL\b",
    r"Regarding the SQL\b",
    r"Regarding game engine\b",
    r"Regarding determinism\b",
    r"For the SQL\b",
    r"For SQL\b",
    r"For Bash\b",
    r"SQL,\s*Bash,\s*YAML/JSON,\s*and\s*Terraform\b",
    r"The TypeScript file provided here only covers\b",
    r"I cannot generate them without specific\b",
    r"You should replace it with your own\b",
    r"If you need help with that aspect\b",
    r"However,\s*they should follow the specified rules\b",
    r"I'?ll assume you have the necessary knowledge\b",
]

PROSE_RE = re.compile(
    r"^\s*(?:\d+\s*:\s*)?(?:"
    + "|".join(PROSE_START_PATTERNS)
    + r")",
    re.IGNORECASE,
)

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
    re.compile(r"^\s*(public|private|protected)\b"),
    re.compile(r"^\s*return\b"),
    re.compile(r"^\s*if\s*\("),
    re.compile(r"^\s*for\s*\("),
    re.compile(r"^\s*while\s*\("),
    re.compile(r"^\s*switch\s*\("),
    re.compile(r"^\s*[}\])],?\s*$"),
]

FOREIGN_LINE_RE = re.compile(
    r"^\s*(?:\d+\s*:\s*)?(?:"
    r"--\s+.*|"                     # SQL comments
    r"CREATE\s+TABLE\b|ALTER\s+TABLE\b|DROP\s+TABLE\b|"
    r"CREATE\s+INDEX\b|INSERT\s+INTO\b|UPDATE\b|DELETE\s+FROM\b|"
    r"SELECT\b|WITH\b|FROM\b|WHERE\b|VALUES\b|RETURNING\b|"
    r"BEGIN;|COMMIT;|ROLLBACK;|"
    r"#!/usr/bin/env\s+bash\b|set\s+-euo\s+pipefail\b|"
    r"terraform\s*\{|provider\s+\"[^\"]+\"\s*\{|resource\s+\"[^\"]+\"\s+\"[^\"]+\"\s*\{|"
    r"apiVersion:\s*\S+|kind:\s*\S+"
    r")",
    re.IGNORECASE,
)

# Some obvious "explanation" lines that can appear mid-block
EXPLANATION_CONTINUATION_RE = re.compile(
    r"^\s*(?:\d+\s*:\s*)?(?:"
    r"The code follows\b|The code below\b|Replace this with\b|"
    r"This can be achieved\b|This example\b|Production-ready\b"
    r")",
    re.IGNORECASE,
)

@dataclass
class Stats:
    changed_files: int = 0
    removed_prose_lines: int = 0
    removed_fence_markers: int = 0
    removed_non_ts_fence_lines: int = 0
    removed_foreign_block_lines: int = 0
    removed_leading_noise_lines: int = 0


def is_code_start(line: str) -> bool:
    return any(p.search(line) for p in CODE_START_PATTERNS)


def trim_blanks(lines: list[str]) -> list[str]:
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    return lines


def strip_fenced_blocks(lines: list[str], stats: Stats) -> list[str]:
    out: list[str] = []
    in_fence = False
    keep_fence = False

    for line in lines:
        m = FENCE_RE.match(line)
        if m:
            lang = (m.group("lang") or "").lower()
            stats.removed_fence_markers += 1
            if not in_fence:
                in_fence = True
                keep_fence = lang in TS_FENCE_LANGS
            else:
                in_fence = False
                keep_fence = False
            continue

        if in_fence:
            if keep_fence:
                out.append(line)
            else:
                stats.removed_non_ts_fence_lines += 1
            continue

        out.append(line)

    return out


def strip_prose_and_injected_blocks(lines: list[str], stats: Stats) -> list[str]:
    """
    If we hit a prose trigger, drop that line and enter "injected block" mode.
    While in injected block mode, remove foreign/example lines and explanation lines
    until we encounter an obvious TS code line.
    """
    out: list[str] = []
    in_injected_block = False

    for line in lines:
        stripped = line.lstrip()

        # Keep actual comments/JSDoc normally unless we're in injected block cleanup.
        if not in_injected_block:
            if PROSE_RE.match(line):
                stats.removed_prose_lines += 1
                in_injected_block = True
                continue

            out.append(line)
            continue

        # in injected block mode
        if not line.strip():
            stats.removed_foreign_block_lines += 1
            continue

        if PROSE_RE.match(line) or EXPLANATION_CONTINUATION_RE.match(line):
            stats.removed_prose_lines += 1
            continue

        if FOREIGN_LINE_RE.match(line):
            stats.removed_foreign_block_lines += 1
            continue

        # Markdown-ish bullets/narration often follow explanations
        if re.match(r"^\s*(?:[-*]\s+|\d+\)\s+)", line):
            stats.removed_foreign_block_lines += 1
            continue

        # Resume when TS code starts
        if is_code_start(line):
            in_injected_block = False
            out.append(line)
            continue

        # Conservative: drop unknown lines while inside an injected block
        stats.removed_foreign_block_lines += 1

    return out


def trim_leading_noncode_noise(lines: list[str], stats: Stats) -> list[str]:
    first_code_idx: Optional[int] = None
    for i, line in enumerate(lines):
        if is_code_start(line):
            first_code_idx = i
            break

    if first_code_idx is None:
        lines = trim_blanks(lines)
        return lines

    if first_code_idx > 0:
        stats.removed_leading_noise_lines += sum(1 for ln in lines[:first_code_idx] if ln.strip())
        lines = lines[first_code_idx:]

    return trim_blanks(lines)


def sanitize_text(text: str, stats: Stats) -> str:
    lines = text.splitlines()
    lines = strip_fenced_blocks(lines, stats)
    lines = strip_prose_and_injected_blocks(lines, stats)
    lines = trim_leading_noncode_noise(lines, stats)
    return ("\n".join(lines) + "\n") if lines else ""


def detect_leftovers(text: str) -> list[str]:
    needles = [
        "```",
        "This code defines",
        "This TypeScript file includes",
        "This TypeScript file exports",
        "Regarding determinism",
        "For Bash, YAML/JSON, and Terraform",
        "SQL, Bash, YAML/JSON, and Terraform",
        "For SQL, I'll provide",
        "Please note that",
    ]
    return [n for n in needles if n in text]


def main() -> int:
    if not SRC.exists():
        print(f"ERROR: missing src dir: {SRC}")
        return 1

    BACKUP.mkdir(parents=True, exist_ok=True)
    stats = Stats()
    still_bad: list[str] = []

    ts_files = sorted(SRC.rglob("*.ts"))

    for fp in ts_files:
        original = fp.read_text(encoding="utf-8", errors="ignore")
        cleaned = sanitize_text(original, stats)

        if cleaned != original:
            backup_path = BACKUP / fp.relative_to(ROOT)
            backup_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(fp, backup_path)
            fp.write_text(cleaned, encoding="utf-8")
            stats.changed_files += 1

        post = fp.read_text(encoding="utf-8", errors="ignore")
        leftovers = detect_leftovers(post)
        if leftovers:
            still_bad.append(f"{fp.relative_to(ROOT)} :: {', '.join(leftovers)}")

    print(f"Scanned .ts files: {len(ts_files)}")
    print(f"Changed files: {stats.changed_files}")
    print(f"Backup dir: {BACKUP}")
    print("Removed totals:")
    print(f"  prose lines: {stats.removed_prose_lines}")
    print(f"  fence markers: {stats.removed_fence_markers}")
    print(f"  non-TS fenced lines: {stats.removed_non_ts_fence_lines}")
    print(f"  injected/foreign lines: {stats.removed_foreign_block_lines}")
    print(f"  leading noise lines: {stats.removed_leading_noise_lines}")

    if still_bad:
        print("\nStill contaminated:")
        for row in still_bad[:500]:
            print(" -", row)
        if len(still_bad) > 500:
            print(f" ... and {len(still_bad)-500} more")
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())