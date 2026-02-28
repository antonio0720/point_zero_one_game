#!/usr/bin/env python3
"""pzo_state.py — durable runner state, heartbeat, and phase-level progress tracking.

V2 ADDITIONS over v1:
  - phase_progress: per-phase (done, total) counts for monitor phase bars
  - gate_failures: set of phase gate task_ids that failed (blocks downstream)
  - atomic state writes using tmp+rename pattern (no corrupt state on crash)
  - retry_context: stores last failure stderr/output for context-aware retry prompts
  - run_uuid: unique run identifier for log correlation

Version: 2.0.0 (2026-02-27)
"""

from __future__ import annotations

import json
import os
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from pzo_config import HEARTBEAT_INTERVAL_S


def _utc_iso() -> str:
    import datetime as _dt
    return _dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


@dataclass
class RunnerState:
    # ── Task tracking ──────────────────────────────────────────────────────
    completed:       List[str] = field(default_factory=list)
    failed:          List[str] = field(default_factory=list)
    failure_reasons: Dict[str, str] = field(default_factory=dict)
    attempts:        Dict[str, int] = field(default_factory=dict)

    # ── Gate tracking (phase gates that failed — hard-block dependents) ────
    gate_failures:   List[str] = field(default_factory=list)

    # ── Retry context (last error output per task, for context-aware retry) ─
    # retry_context[task_id] = {"stderr": "...", "validation_output": "...", "broken_file": "..."}
    retry_context:   Dict[str, Dict[str, str]] = field(default_factory=dict)

    # ── Execution stats ────────────────────────────────────────────────────
    crashes:         int = 0
    task_times:      List[float] = field(default_factory=list)

    # ── Cursor state ───────────────────────────────────────────────────────
    current_task:    str = ""
    last_written:    str = ""

    # ── Timestamps ─────────────────────────────────────────────────────────
    started_utc:     str = field(default_factory=_utc_iso)
    updated_utc:     str = field(default_factory=_utc_iso)
    run_uuid:        str = field(default_factory=lambda: str(uuid.uuid4())[:8])

    # ── Convenience sets (not serialized) ─────────────────────────────────
    def completed_set(self) -> set:
        return set(self.completed)

    def failed_set(self) -> set:
        return set(self.failed)

    def gate_failed_set(self) -> set:
        return set(self.gate_failures)

    def is_gate_failed(self, task_id: str) -> bool:
        return task_id in self.gate_failures

    def mark_gate_failed(self, task_id: str) -> None:
        if task_id not in self.gate_failures:
            self.gate_failures.append(task_id)

    def clear_gate_failure(self, task_id: str) -> None:
        self.gate_failures = [x for x in self.gate_failures if x != task_id]

    def store_retry_context(self, task_id: str, stderr: str = "", validation_output: str = "", broken_file: str = "") -> None:
        self.retry_context[task_id] = {
            "stderr":            stderr[:2000],    # cap to avoid bloating state
            "validation_output": validation_output[:2000],
            "broken_file":       broken_file[:4000],  # first 4KB of broken file
        }

    def get_retry_context(self, task_id: str) -> Dict[str, str]:
        return self.retry_context.get(task_id, {})


def load_state(path: Path) -> RunnerState:
    """Load state from JSON file. On corruption, backs up and returns fresh state."""
    try:
        if not path.exists():
            return RunnerState()
        raw = json.loads(path.read_text(encoding="utf-8"))
        st = RunnerState()
        for k, v in raw.items():
            if hasattr(st, k):
                setattr(st, k, v)
        return st
    except Exception:
        # Back up corrupted state file
        try:
            bak = path.with_suffix(f".corrupt.{int(time.time())}")
            if path.exists():
                bak.write_bytes(path.read_bytes())
        except Exception:
            pass
        return RunnerState()


def save_state(path: Path, st: RunnerState) -> None:
    """Atomically write state using tmp+rename (crash-safe)."""
    st.updated_utc = _utc_iso()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    try:
        data = {k: v for k, v in st.__dict__.items() if not k.startswith("_")}
        tmp.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
        os.replace(tmp, path)
    except Exception:
        try:
            tmp.unlink(missing_ok=True)
        except Exception:
            pass
        raise


def write_heartbeat(path: Path, runner_pid: int, current_task: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "last_heartbeat_utc": _utc_iso(),
        "epoch_s":    time.time(),
        "runner_pid": runner_pid,
        "current_task": current_task or "",
    }
    tmp = path.with_suffix(".hb.tmp")
    tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def heartbeat_loop(stop_flag, heartbeat_path: Path, st_ref, runner_pid: int) -> None:
    """Background heartbeat loop. stop_flag must have .is_set() and .wait()."""
    while not stop_flag.is_set():
        try:
            cur = getattr(st_ref, "current_task", "") if st_ref else ""
            write_heartbeat(heartbeat_path, runner_pid, cur)
        except Exception:
            pass
        stop_flag.wait(HEARTBEAT_INTERVAL_S)
