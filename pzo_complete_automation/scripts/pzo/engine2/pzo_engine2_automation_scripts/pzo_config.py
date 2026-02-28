#!/usr/bin/env python3
"""pzo_config.py — PZO Automation Configuration (Engine 2 / Pressure Engine v4)

Central configuration for:
  - Tier map (models, timeouts, retries, num_predict — deadlock-safe)
  - Absolute paths for v4 taskbook, repo root, runtime dirs
  - Deadlock prevention thresholds
  - Watchdog + heartbeat intervals

DEADLOCK RULE (enforced at import): phi3:mini must NEVER exceed num_predict=2048.
Exceeding this fills the OS pipe buffer (~64KB) causing curl+Python deadlock.
qwen3:8b at 4096 is safe — larger context window and different streaming behavior.

Version: 2.0.0 (2026-02-27)
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict

# ── Base paths ─────────────────────────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).resolve().parent
RUNTIME_DIR  = SCRIPT_DIR / "runtime"
OUTPUTS_DIR  = RUNTIME_DIR / "outputs"
LOGS_DIR     = RUNTIME_DIR / "logs"
ARTIFACTS_DIR = RUNTIME_DIR / "artifacts"

# ── V4 Taskbook — single NDJSON file (not a directory) ────────────────────────
# Override with env PZO_ENGINE2_TASKBOOK or CLI --taskbook
_DEFAULT_TASKBOOK = (
    "/Users/mervinlarry/workspaces/adam/Projects/adam/"
    "point_zero_one_master/pzo_complete_automation/scripts/pzo/engine2/"
    "pzo_engine2_pressure_taskbook_v4.ndjson"
)
DEFAULT_TASKBOOK_PATH = Path(os.getenv("PZO_ENGINE2_TASKBOOK", _DEFAULT_TASKBOOK))

# ── Repo root — where pzo-web/ lives ──────────────────────────────────────────
_DEFAULT_REPO = (
    "/Users/mervinlarry/workspaces/adam/Projects/adam/"
    "point_zero_one_master"
)
DEFAULT_REPO_ROOT = Path(os.getenv("PZO_REPO_ROOT", _DEFAULT_REPO))

# ── Runtime file paths ─────────────────────────────────────────────────────────
STATE_PATH     = Path(os.getenv("PZO_ENGINE2_STATE_PATH",     str(RUNTIME_DIR / "pzo_engine2_state.json")))
HEARTBEAT_PATH = Path(os.getenv("PZO_ENGINE2_HEARTBEAT_PATH", str(RUNTIME_DIR / "pzo_engine2_heartbeat.json")))
WATCHDOG_PATH  = Path(os.getenv("PZO_ENGINE2_WATCHDOG_PATH",  str(RUNTIME_DIR / "pzo_engine2_watchdog.json")))
LOG_PATH       = Path(os.getenv("PZO_ENGINE2_LOG_PATH",       str(LOGS_DIR / "pzo_engine2_runner.log")))

# ── Tier map ───────────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class TierSpec:
    tier:        str
    model:       str
    timeout_s:   int
    retries:     int
    num_predict: int
    used_for:    str

# DEADLOCK RULE: phi3:mini MUST NOT exceed 2048 num_predict.
# Pipe buffer overflow at source — causes permanent hang at communicate().
TIER_MAP: Dict[str, TierSpec] = {
    "L0": TierSpec("L0", "phi3:mini",  90,  2, 1024, "Governance, preflight, scaffold, typecheck gates"),
    "L1": TierSpec("L1", "phi3:mini", 150,  2, 2048, "Types, class shells, CSS, simple methods"),
    "L2": TierSpec("L2", "phi3:mini", 300,  1, 2048, "Signals, hooks, React components, store handlers → retry escalates to qwen3:8b"),
    "L3": TierSpec("L3", "qwen3:8b",  420,  1, 4096, "PressureEngine core, integration tests, critical orchestration"),
}

# L2 escalation target on first retry
L2_ESCALATION_TIER = "L3"

# ── Watchdog / heartbeat thresholds ───────────────────────────────────────────
HEARTBEAT_INTERVAL_S = int(os.getenv("PZO_HEARTBEAT_INTERVAL_S", "30"))
WATCHDOG_POLL_S      = int(os.getenv("PZO_WATCHDOG_POLL_S",      "60"))
HEARTBEAT_STALE_S    = int(os.getenv("PZO_HEARTBEAT_STALE_S",    "600"))
LOG_STALE_S          = int(os.getenv("PZO_LOG_STALE_S",          "600"))

# ── Ollama endpoints ───────────────────────────────────────────────────────────
OLLAMA_HOST              = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_GENERATE_ENDPOINT = f"{OLLAMA_HOST.rstrip('/')}/api/generate"
OLLAMA_TAGS_ENDPOINT     = f"{OLLAMA_HOST.rstrip('/')}/api/tags"

# ── Task type routing ──────────────────────────────────────────────────────────
# These task types run shell commands ONLY — never call LLM
SHELL_ONLY_TASK_TYPES = frozenset({"audit", "validation", "filesystem_scaffold", "scaffold"})
# These task types are phase gates — failure hard-blocks all dependents
GATE_TASK_TYPES = frozenset({"validation", "audit"})
# automation_tags that mark a task as a phase gate
GATE_TAGS = frozenset({"gate", "phase_gate", "typecheck"})


def is_gate_task(task) -> bool:
    """True if this task is a phase gate that should hard-block dependents on failure."""
    if task.task_type in GATE_TASK_TYPES:
        return True
    tags = set(getattr(task, "tags", []) or []) | set(getattr(task, "automation_tags", []) or [])
    return bool(tags & GATE_TAGS)


# ── Safety assertions (enforced at import time) ────────────────────────────────
def _validate_tier_map() -> None:
    for tier, spec in TIER_MAP.items():
        if spec.model == "phi3:mini":
            assert spec.num_predict <= 2048, (
                f"DEADLOCK RULE VIOLATION: {tier} phi3:mini "
                f"num_predict={spec.num_predict} > 2048 — will cause pipe buffer deadlock"
            )

_validate_tier_map()
