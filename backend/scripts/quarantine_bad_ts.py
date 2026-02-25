#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
QUAR = ROOT / ".quarantine_ts"
TSCONFIG = ROOT / "tsconfig.json"
TSCONFIG_BACKUP = ROOT / "tsconfig.json.pre_quarantine_backup"

# Lightweight signatures that indicate LLM contamination still exists
BAD_NEEDLES = [
    "Here is the TypeScript file",
    "```",
    "This TypeScript file exports",
    "Regarding the SQL, YAML/JSON, and Bash files",
]

def find_bad_ts_files() -> list[Path]:
    bad: list[Path] = []
    for fp in sorted(SRC.rglob("*.ts")):
        text = fp.read_text(encoding="utf-8", errors="ignore")
        if any(n in text for n in BAD_NEEDLES):
            bad.append(fp)
    return bad

def quarantine_files(files: list[Path]) -> None:
    QUAR.mkdir(parents=True, exist_ok=True)
    for fp in files:
        target = QUAR / fp.relative_to(ROOT)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(fp), str(target))

def patch_tsconfig_exclude(quarantined_files: list[Path]) -> None:
    if not TSCONFIG.exists():
        print("WARN: tsconfig.json not found; skipping tsconfig patch.")
        return

    if not TSCONFIG_BACKUP.exists():
        shutil.copy2(TSCONFIG, TSCONFIG_BACKUP)

    data = json.loads(TSCONFIG.read_text(encoding="utf-8"))
    exclude = data.get("exclude", [])
    if not isinstance(exclude, list):
        exclude = [exclude]

    rel_quar = str(QUAR.relative_to(ROOT)).replace("\\", "/")
    if rel_quar not in exclude:
        exclude.append(rel_quar)

    data["exclude"] = exclude
    TSCONFIG.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

def main() -> int:
    bad = find_bad_ts_files()
    print(f"Remaining contaminated .ts files: {len(bad)}")
    if not bad:
        print("No quarantine needed.")
        return 0

    for fp in bad[:500]:
        print(f" - {fp.relative_to(ROOT)}")
    if len(bad) > 500:
        print(f" ... and {len(bad) - 500} more")

    quarantine_files(bad)
    patch_tsconfig_exclude(bad)

    print(f"\nQuarantined to: {QUAR}")
    print(f"tsconfig backup: {TSCONFIG_BACKUP if TSCONFIG.exists() else 'n/a'}")
    print("\nNow run:")
    print("  npm run typecheck")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())