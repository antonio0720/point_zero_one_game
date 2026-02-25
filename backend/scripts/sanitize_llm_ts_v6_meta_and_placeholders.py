#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # backend/
SRC = ROOT / "src"
BACKUP = ROOT / ".backup_llm_corruption_v6"

LINE_NUM_PREFIX_RE = re.compile(r"^\s*\d+\s*:\s*")

# ---- LLM prose/meta garbage starts (outside template literals) ----
META_START_RE = re.compile(
    r"^\s*(?:\d+\s*:\s*)?(?:"
    r"Regarding\b|"
    r"This\s+TypeScript\b|"
    r"The\s+TypeScript\s+file\b|"
    r"In\s+this\s+example\b|"
    r"Also,\s+I['’]ve\s+assumed\b|"
    r"For\s+SQL,\s+I['’]ll\s+provide\b|"
    r"For\s+Bash,\s+YAML/JSON,\s+and\s+Terraform\b|"
    r"SQL(?:\s*\([^)]+\))?\s*:\s*$"
    r")",
    re.IGNORECASE,
)

# Continuation bullets/notes often following injected prose
META_CONT_RE = re.compile(
    r"^\s*(?:\d+\s*:\s*)?(?:"
    r"-\s+|"
    r"\*\s+|"
    r"(?:Strict\s+types|All\s+public\s+symbols|JSDoc)\b|"
    r"[A-Z][A-Za-z ]{0,40}:\s*$"
    r")"
)

# SQL-ish lines when they appear as orphan blocks (outside templates)
SQLISH_RE = re.compile(
    r"^\s*(?:"
    r"--\s+.*|"
    r"CREATE\s+(?:TABLE|INDEX|UNIQUE\s+INDEX)\b|"
    r"ALTER\s+TABLE\b|DROP\s+(?:TABLE|INDEX)\b|"
    r"INSERT\s+INTO\b|UPDATE\b|DELETE\s+FROM\b|"
    r"SELECT\b|WITH\b|FROM\b|WHERE\b|VALUES\b|RETURNING\b|"
    r"BEGIN;|COMMIT;|ROLLBACK;|"
    r"ON\s+CONFLICT\b|"
    r"PRIMARY\s+KEY\b|FOREIGN\s+KEY\b|REFERENCES\b|CONSTRAINT\b|"
    r"NOT\s+NULL\b|UNIQUE\b|CHECK\s*\(|DEFAULT\b|"
    r"\(\s*$|\)\s*;?\s*$|,\s*$|"
    r"[A-Za-z_][A-Za-z0-9_]*\s+(?:TEXT|VARCHAR|CHAR|INT|INTEGER|BIGINT|SMALLINT|NUMERIC|DECIMAL|REAL|DOUBLE|FLOAT|BOOLEAN|BOOL|TIMESTAMP|DATE|TIME|UUID|JSON|JSONB)\b.*"
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

# Placeholder junk patterns
ELLIPSIS_ARRAY_RE = re.compile(r"=\s*\[\s*\.\.\.\s*]\s*;")
ELLIPSIS_TUPLE_RE = re.compile(r"\[\s*\.\.\.\s*]")
INLINE_BLOCK_PLACEHOLDER_ASSIGN_RE = re.compile(
    r"^(\s*(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*)/\*.*?\*/(\s*;\s*)$"
)
NUMERIC_20XX_RE = re.compile(r"\b20XX\b")

def strip_line_num_prefix(s: str) -> str:
    return LINE_NUM_PREFIX_RE.sub("", s)

def count_unescaped_backticks(line: str) -> int:
    count = 0
    esc = False
    for ch in line:
        if esc:
            esc = False
            continue
        if ch == "\\":
            esc = True
            continue
        if ch == "`":
            count += 1
    return count

@dataclass
class Stats:
    changed_files: int = 0
    removed_meta_lines: int = 0
    removed_sql_orphan_lines: int = 0
    removed_blocks: int = 0
    placeholder_fixes: int = 0
    year_fixes: int = 0
    suspected_template_fractures: list[str] = field(default_factory=list)

def sanitize_ts(text: str, relpath: str, stats: Stats) -> str:
    lines = text.splitlines()
    out: list[str] = []

    in_template = False
    dropping_meta_block = False
    dropping_sql_block = False

    i = 0
    while i < len(lines):
        line = lines[i]
        probe = strip_line_num_prefix(line)

        # --- begin drop: meta prose block ---
        if not in_template and not dropping_meta_block and not dropping_sql_block and META_START_RE.match(probe):
            dropping_meta_block = True
            stats.removed_blocks += 1
            stats.removed_meta_lines += 1
            i += 1
            continue

        if dropping_meta_block:
            probe2 = strip_line_num_prefix(line)

            if not probe2.strip():
                stats.removed_meta_lines += 1
                i += 1
                continue

            # Sometimes "SQL:" block follows prose
            if probe2.strip().lower().startswith("sql"):
                stats.removed_meta_lines += 1
                i += 1
                continue

            if META_CONT_RE.match(probe2):
                stats.removed_meta_lines += 1
                i += 1
                continue

            if SQLISH_RE.match(probe2):
                stats.removed_sql_orphan_lines += 1
                i += 1
                continue

            if TS_CODE_START_RE.match(probe2):
                dropping_meta_block = False
                # continue to normal processing of this line
            else:
                # Conservative: keep dropping unknown continuation lines until TS resumes
                stats.removed_meta_lines += 1
                i += 1
                continue

        # --- begin drop: orphan SQL block starting with '--' ---
        if not in_template and not dropping_sql_block and probe.lstrip().startswith("-- "):
            dropping_sql_block = True
            stats.removed_blocks += 1
            stats.removed_sql_orphan_lines += 1
            i += 1
            continue

        if dropping_sql_block:
            probe2 = strip_line_num_prefix(line)
            if not probe2.strip():
                stats.removed_sql_orphan_lines += 1
                i += 1
                continue
            if SQLISH_RE.match(probe2):
                stats.removed_sql_orphan_lines += 1
                i += 1
                continue
            if TS_CODE_START_RE.match(probe2):
                dropping_sql_block = False
                # continue to normal processing
            else:
                stats.removed_sql_orphan_lines += 1
                i += 1
                continue

        # --- normal line transforms (outside templates only) ---
        new_line = line
        if not in_template:
            # Fix placeholder array "[...]" -> []
            if ELLIPSIS_ARRAY_RE.search(new_line):
                new_line = ELLIPSIS_ARRAY_RE.sub("= [];", new_line)
                stats.placeholder_fixes += 1
            else:
                # More general [...]-only literals in code
                if ELLIPSIS_TUPLE_RE.search(new_line) and "..." in new_line and not re.search(r"\.\.\.[A-Za-z_$]", new_line):
                    new_line2 = ELLIPSIS_TUPLE_RE.sub("[]", new_line)
                    if new_line2 != new_line:
                        new_line = new_line2
                        stats.placeholder_fixes += 1

            # Fix const x = /* placeholder */;
            m = INLINE_BLOCK_PLACEHOLDER_ASSIGN_RE.match(new_line)
            if m:
                new_line = f"{m.group(1)}undefined as unknown{m.group(2)}"
                stats.placeholder_fixes += 1

            # Fix literal 20XX placeholder
            if NUMERIC_20XX_RE.search(new_line):
                new_line = NUMERIC_20XX_RE.sub("2026", new_line)
                stats.year_fixes += 1

        out.append(new_line)

        # Track template literal state after writing line
        if count_unescaped_backticks(new_line) % 2 == 1:
            in_template = not in_template

        i += 1

    if in_template:
        stats.suspected_template_fractures.append(relpath)

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
        cleaned = sanitize_ts(original, str(fp.relative_to(ROOT)), stats)

        if cleaned != original:
            backup_path = BACKUP / fp.relative_to(ROOT)
            backup_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(fp, backup_path)
            fp.write_text(cleaned, encoding="utf-8")
            stats.changed_files += 1

    print(f"Scanned .ts files: {len(ts_files)}")
    print(f"Changed files: {stats.changed_files}")
    print(f"Backup dir: {BACKUP}")
    print(f"Removed blocks: {stats.removed_blocks}")
    print(f"Removed meta prose lines: {stats.removed_meta_lines}")
    print(f"Removed SQL-orphan lines: {stats.removed_sql_orphan_lines}")
    print(f"Placeholder fixes: {stats.placeholder_fixes}")
    print(f"20XX fixes: {stats.year_fixes}")
    if stats.suspected_template_fractures:
        print("Suspected template literal fractures (odd backticks after cleanup):")
        for p in stats.suspected_template_fractures:
            print(f"  - {p}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())