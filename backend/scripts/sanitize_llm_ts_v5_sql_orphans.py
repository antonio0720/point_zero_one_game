#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # backend/
SRC = ROOT / "src"
BACKUP = ROOT / ".backup_llm_corruption_v5"

SQL_START_RE = re.compile(r"^\s*--\s+")
SQLISH_RE = re.compile(
    r"^\s*(?:"
    r"--\s+.*|"
    r"CREATE\s+(?:TABLE|INDEX|UNIQUE\s+INDEX)\b|"
    r"ALTER\s+TABLE\b|"
    r"DROP\s+(?:TABLE|INDEX)\b|"
    r"INSERT\s+INTO\b|"
    r"UPDATE\b|DELETE\s+FROM\b|"
    r"SELECT\b|WITH\b|FROM\b|WHERE\b|VALUES\b|RETURNING\b|"
    r"BEGIN;|COMMIT;|ROLLBACK;|"
    r"ON\s+CONFLICT\b|"
    r"PRIMARY\s+KEY\b|FOREIGN\s+KEY\b|REFERENCES\b|CONSTRAINT\b|"
    r"NOT\s+NULL\b|UNIQUE\b|CHECK\s*\(|DEFAULT\b|"
    r"[A-Za-z_][A-Za-z0-9_]*\s+(?:TEXT|VARCHAR|CHAR|INT|INTEGER|BIGINT|SMALLINT|NUMERIC|DECIMAL|REAL|DOUBLE|FLOAT|BOOLEAN|BOOL|TIMESTAMP|DATE|TIME|UUID|JSON|JSONB)\b.*|"
    r"\(\s*$|\)\s*;?\s*$|,\s*$"
    r")",
    re.IGNORECASE,
)

TS_CODE_START_RE = re.compile(
    r"^\s*(?:"
    r"/\*\*|/\*|//|"
    r"import\b|export\b|"
    r"@[\w$]+|"
    r"(?:abstract\s+)?class\b|interface\b|type\b|enum\b|namespace\b|"
    r"(?:const|let|var)\b|function\b|async\s+function\b|"
    r"(?:public|private|protected|readonly|static)\b|"
    r"return\b|throw\b|try\b|catch\b|finally\b|"
    r"if\s*\(|for\s*\(|while\s*\(|switch\s*\(|do\b|"
    r"[}\])],?\s*$"
    r")"
)

LINE_NUM_PREFIX_RE = re.compile(r"^\s*\d+\s*:\s*")

@dataclass
class Stats:
    changed_files: int = 0
    removed_lines: int = 0
    removed_blocks: int = 0


def strip_line_num_prefix(s: str) -> str:
    return LINE_NUM_PREFIX_RE.sub("", s)


def count_unescaped_backticks(line: str) -> int:
    # cheap heuristic for template literal context
    count = 0
    escaped = False
    for ch in line:
        if escaped:
            escaped = False
            continue
        if ch == "\\":
            escaped = True
            continue
        if ch == "`":
            count += 1
    return count


def sanitize_ts(text: str, stats: Stats) -> str:
    lines = text.splitlines()
    out: list[str] = []

    in_template = False
    dropping_sql_block = False

    i = 0
    while i < len(lines):
        line = lines[i]
        probe = strip_line_num_prefix(line)

        # Start orphan SQL block removal ONLY when not inside template literal
        if not in_template and not dropping_sql_block and SQL_START_RE.match(probe):
            dropping_sql_block = True
            stats.removed_blocks += 1
            stats.removed_lines += 1
            i += 1
            continue

        if dropping_sql_block:
            probe2 = strip_line_num_prefix(line)

            # keep removing blanks + SQL-ish lines
            if not probe2.strip():
                stats.removed_lines += 1
                i += 1
                continue

            if SQLISH_RE.match(probe2):
                stats.removed_lines += 1
                i += 1
                continue

            # end block when we hit obvious TS code
            if TS_CODE_START_RE.match(probe2):
                dropping_sql_block = False
                out.append(line)
                if count_unescaped_backticks(line) % 2 == 1:
                    in_template = not in_template
                i += 1
                continue

            # conservative: if unknown line appears during SQL block, drop it too
            stats.removed_lines += 1
            i += 1
            continue

        # normal line
        out.append(line)
        if count_unescaped_backticks(line) % 2 == 1:
            in_template = not in_template
        i += 1

    # preserve trailing newline if file had content
    return ("\n".join(out) + "\n") if out else ""


def main() -> int:
    if not SRC.exists():
        print(f"ERROR: missing src dir: {SRC}")
        return 1

    BACKUP.mkdir(parents=True, exist_ok=True)
    stats = Stats()

    ts_files = sorted(SRC.rglob("*.ts"))
    for fp in ts_files:
        original = fp.read_text(encoding="utf-8", errors="ignore")
        cleaned = sanitize_ts(original, stats)

        if cleaned != original:
            backup_path = BACKUP / fp.relative_to(ROOT)
            backup_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(fp, backup_path)
            fp.write_text(cleaned, encoding="utf-8")
            stats.changed_files += 1

    print(f"Scanned .ts files: {len(ts_files)}")
    print(f"Changed files: {stats.changed_files}")
    print(f"Backup dir: {BACKUP}")
    print(f"Removed SQL-orphan blocks: {stats.removed_blocks}")
    print(f"Removed lines: {stats.removed_lines}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())