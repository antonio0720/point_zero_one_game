#!/usr/bin/env python3
"""pzo_preflight.py — pre-run validation gate.

Checks before the runner starts:
  1. Ollama reachable (/api/tags)
  2. Required tier models are pulled (warns on missing)
  3. Taskbook file exists and is valid NDJSON
  4. Repo root exists and contains pzo-web/
  5. Runtime dirs are writable
  6. Dependency cycles in taskbook (fatal)
  7. Deadlock rule: all phi3:mini tiers <= 2048 num_predict

Exit codes:
  0   All clear — safe to launch runner
  1   Fatal error (fix before running)
  2   Ollama unreachable
  3   Runtime dirs unwritable
  4   Taskbook invalid

Version: 2.0.0 (2026-02-27)
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import List, Tuple

from pzo_config import (
    DEFAULT_REPO_ROOT,
    DEFAULT_TASKBOOK_PATH,
    OLLAMA_TAGS_ENDPOINT,
    OUTPUTS_DIR,
    RUNTIME_DIR,
    TIER_MAP,
)
from pzo_taskbook import detect_cycles, load_taskbook


def _curl_json(url: str) -> dict | None:
    try:
        out = subprocess.check_output(
            ["curl", "-sS", "--connect-timeout", "5", "--max-time", "8", url],
            text=True, timeout=10,
        )
        return json.loads(out)
    except Exception:
        return None


def _ok(msg: str) -> None:
    print(f"  \033[1;32m✓\033[0m  {msg}")

def _warn(msg: str) -> None:
    print(f"  \033[1;33m⚠\033[0m  {msg}")

def _fail(msg: str) -> None:
    print(f"  \033[1;31m✗\033[0m  {msg}")


def run_preflight(taskbook_path: Path = DEFAULT_TASKBOOK_PATH,
                  repo_root: Path = DEFAULT_REPO_ROOT) -> int:
    print("\n\033[1;36m══════ PZO Engine 2 — Pre-flight Check ══════\033[0m\n")
    errors: List[str] = []
    warnings: List[str] = []

    # ── 1. Ollama reachability ────────────────────────────────────────────────
    print("[ Ollama ]")
    tags_data = _curl_json(OLLAMA_TAGS_ENDPOINT)
    if tags_data is None:
        _fail(f"Ollama unreachable at {OLLAMA_TAGS_ENDPOINT}")
        errors.append("ollama_unreachable")
    else:
        pulled_models = {m.get("name", "") for m in tags_data.get("models", [])}
        _ok(f"Ollama responding — {len(pulled_models)} models found")

        # ── 2. Required tier models ────────────────────────────────────────────
        print("\n[ Tier Models ]")
        required = {spec.model for spec in TIER_MAP.values()}
        for model in sorted(required):
            # Ollama tags may include :latest suffix — normalize
            matched = any(p.split(":")[0] == model.split(":")[0] for p in pulled_models)
            if matched:
                _ok(f"{model} — pulled")
            else:
                _warn(f"{model} — NOT pulled (run: ollama pull {model})")
                warnings.append(f"model_missing:{model}")

    # ── 3. Taskbook ───────────────────────────────────────────────────────────
    print("\n[ Taskbook ]")
    if not taskbook_path.exists():
        _fail(f"Taskbook not found: {taskbook_path}")
        errors.append("taskbook_missing")
    else:
        try:
            result = load_taskbook(taskbook_path)
            _ok(f"Loaded {result.total} tasks from {taskbook_path.name}")
            for w in result.warnings:
                _warn(f"  {w}")

            # Cycle detection
            cycles = detect_cycles(result.tasks)
            if cycles:
                for cycle in cycles:
                    _fail(f"Dependency cycle: {' -> '.join(cycle)}")
                    errors.append("dependency_cycle")
            else:
                _ok("No dependency cycles")

            # Phase summary
            phases = result.phase_groups()
            _ok(f"{len(phases)} phases loaded: {', '.join(phases.keys())}")

        except Exception as e:
            _fail(f"Taskbook parse error: {e}")
            errors.append("taskbook_parse_error")

    # ── 4. Repo root ──────────────────────────────────────────────────────────
    print("\n[ Repo Root ]")
    if not repo_root.exists():
        _fail(f"Repo root not found: {repo_root}")
        errors.append("repo_root_missing")
    elif not (repo_root / "pzo-web").exists():
        _fail(f"pzo-web/ not found inside repo root: {repo_root}")
        errors.append("pzo_web_missing")
    else:
        _ok(f"Repo root valid: {repo_root}")
        _ok(f"pzo-web/ present")

    # ── 5. Runtime dirs writable ──────────────────────────────────────────────
    print("\n[ Runtime Dirs ]")
    for d in [RUNTIME_DIR, OUTPUTS_DIR]:
        try:
            d.mkdir(parents=True, exist_ok=True)
            test_file = d / ".preflight_write_test"
            test_file.write_text("ok")
            test_file.unlink()
            _ok(f"{d} — writable")
        except Exception as e:
            _fail(f"{d} — NOT writable: {e}")
            errors.append(f"unwritable:{d}")

    # ── 6. Deadlock rule assertion ────────────────────────────────────────────
    print("\n[ Deadlock Rules ]")
    for tier, spec in TIER_MAP.items():
        if spec.model == "phi3:mini" and spec.num_predict > 2048:
            _fail(f"{tier}: phi3:mini num_predict={spec.num_predict} EXCEEDS 2048 — DEADLOCK RISK")
            errors.append(f"deadlock_violation:{tier}")
        else:
            _ok(f"{tier}: {spec.model} np={spec.num_predict} — safe")

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n\033[1;36m══════ Result ══════\033[0m")
    if errors:
        print(f"\n  \033[1;31mFAIL — {len(errors)} error(s) must be fixed before running:\033[0m")
        for e in errors:
            print(f"    • {e}")
        if warnings:
            print(f"\n  \033[1;33m{len(warnings)} warning(s):\033[0m")
            for w in warnings:
                print(f"    • {w}")
        print()
        if "ollama_unreachable" in errors:
            return 2
        if any(e.startswith("unwritable") for e in errors):
            return 3
        if any(e.startswith("taskbook") for e in errors):
            return 4
        return 1
    else:
        if warnings:
            print(f"\n  \033[1;33mPASS with {len(warnings)} warning(s):\033[0m")
            for w in warnings:
                print(f"    • {w}")
        else:
            print(f"\n  \033[1;32mPASS — all checks passed. Safe to launch runner.\033[0m")
        print()
        return 0


def main() -> int:
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--taskbook",  default=str(DEFAULT_TASKBOOK_PATH))
    ap.add_argument("--repo-root", default=str(DEFAULT_REPO_ROOT))
    args = ap.parse_args()
    return run_preflight(
        taskbook_path=Path(args.taskbook).expanduser().resolve(),
        repo_root=Path(args.repo_root).expanduser().resolve(),
    )


if __name__ == "__main__":
    raise SystemExit(main())
