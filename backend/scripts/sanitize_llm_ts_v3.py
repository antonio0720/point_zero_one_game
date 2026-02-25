#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parents[1]  # backend/
SRC = ROOT / "src"
BACKUP = ROOT / ".backup_llm_corruption_v3"

# Matches:
#   ```ts
#   ```sql
#   ```
#   63:```sql
#   104: ```bash
FENCE_RE = re.compile(r"^\s*(?:\d+\s*:\s*)?```(?P<lang>[A-Za-z0-9_-]+)?\s*$")

TS_FENCE_LANGS = {"", "ts", "typescript"}

# Assistant prose lines that should NEVER be in .ts source (raw/uncommented)
PROSE_START_PATTERNS = [
    r"Here is the TypeScript file\b",
    r"Here is the TypeScript file for\b",
    r"This TypeScript file exports\b",
    r"This code defines\b",
    r"Please note that\b",
    r"Regarding SQL\b",
    r"Regarding the SQL\b",
    r"Regarding game engine\b",
    r"For the SQL\b",
    r"The TypeScript file provided here only covers\b",
    r"I cannot generate them without specific\b",
    r"You should replace it with your own\b",
    r"If you need help with that aspect\b",
    r"However, they should follow the specified rules\b",
]

# Allow optional line-number prefixes like "42: "
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
]

# Optional extra raw foreign-language signatures that sometimes leak into .ts
FOREIGN_BLOCK_START_RE = re.compile(
    r"^\s*(?:\d+\s*:\s*)?(?:"
    r"CREATE\s+TABLE\b|ALTER\s+TABLE\b|INSERT\s+INTO\b|"
    r"#!/usr/bin/env\s+bash\b|set\s+-euo\s+pipefail\b|"
    r"terraform\s*\{|resource\s+\"[^\"]+\"\s+\"[^\"]+\"\s*\{|"
    r"apiVersion:\s*\S+|kind:\s*\S+"
    r")",
    re.IGNORECASE,
)

@dataclass
class Stats:
    changed_files: int = 0
    removed_prose_lines: int = 0
    removed_fence_markers: int = 0
    removed_non_ts_fence_lines: int = 0
    removed_foreign_raw_lines: int = 0


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
            continue  # drop all fence marker lines

        if in_fence:
            if keep_fence:
                out.append(line)  # keep TS fenced content
            else:
                stats.removed_non_ts_fence_lines += 1  # drop SQL/Bash/YAML/HCL fenced content
            continue

        out.append(line)

    return out


def strip_known_prose_lines(lines: list[str], stats: Stats) -> list[str]:
    out: list[str] = []
    for line in lines:
        # Never remove actual comments/JSDoc lines
        stripped = line.lstrip()
        if stripped.startswith("//") or stripped.startswith("/*") or stripped.startswith("*"):
            out.append(line)
            continue

        if PROSE_RE.match(line):
            stats.removed_prose_lines += 1
            continue

        out.append(line)
    return out


def strip_trailing_foreign_raw_blocks(lines: list[str], stats: Stats) -> list[str]:
    """
    If raw SQL/YAML/Bash/HCL leaked into the end of a TS file without fences, cut from first obvious foreign line onward.
    Conservative: only triggers after we've seen TS code.
    """
    seen_code = False
    for i, line in enumerate(lines):
        if is_code_start(line):
            seen_code = True
        if seen_code and FOREIGN_BLOCK_START_RE.match(line):
            stats.removed_foreign_raw_lines += (len(lines) - i)
            return lines[:i]
    return lines


def trim_leading_noncode_noise(lines: list[str], stats: Stats) -> list[str]:
    """
    After cleanup, if there is still noise before the first code-ish line, trim it.
    """
    first_code_idx: Optional[int] = None
    for i, line in enumerate(lines):
        if is_code_start(line):
            first_code_idx = i
            break

    if first_code_idx is None:
        return trim_blanks(lines)

    if first_code_idx > 0:
        # Count only non-blank as removed prose/noise
        stats.removed_prose_lines += sum(1 for ln in lines[:first_code_idx] if ln.strip())
        lines = lines[first_code_idx:]

    return trim_blanks(lines)


def sanitize_text(text: str, stats: Stats) -> str:
    lines = text.splitlines()

    lines = strip_fenced_blocks(lines, stats)
    lines = strip_known_prose_lines(lines, stats)
    lines = strip_trailing_foreign_raw_blocks(lines, stats)
    lines = trim_leading_noncode_noise(lines, stats)

    return ("\n".join(lines) + "\n") if lines else ""


def detect_leftovers(text: str) -> list[str]:
    hits: list[str] = []
    needles = [
        "Here is the TypeScript file",
        "This TypeScript file exports",
        "This code defines",
        "Please note that",
        "Regarding the SQL",
        "For the SQL",
        "Regarding game engine",
        "```",
    ]
    for n in needles:
        if n in text:
            hits.append(n)
    return hits


def main() -> int:
    if not SRC.exists():
        print(f"ERROR: missing src dir: {SRC}")
        return 1

    BACKUP.mkdir(parents=True, exist_ok=True)
    stats = Stats()
    still_bad: list[str] = []

    ts_files = sorted(SRC.rglob("*.ts"))
    total = len(ts_files)

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
        leftover = detect_leftovers(post)
        if leftover:
            still_bad.append(f"{fp.relative_to(ROOT)} :: {', '.join(leftover)}")

    print(f"Scanned .ts files: {total}")
    print(f"Changed files: {stats.changed_files}")
    print(f"Backup dir: {BACKUP}")
    print("")
    print("Removed totals:")
    print(f"  prose lines: {stats.removed_prose_lines}")
    print(f"  fence markers: {stats.removed_fence_markers}")
    print(f"  non-TS fenced lines: {stats.removed_non_ts_fence_lines}")
    print(f"  trailing raw foreign lines: {stats.removed_foreign_raw_lines}")

    if still_bad:
        print("\nStill contaminated (manual / quarantine):")
        for row in still_bad[:500]:
            print(f" - {row}")
        if len(still_bad) > 500:
            print(f" ... and {len(still_bad) - 500} more")
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())