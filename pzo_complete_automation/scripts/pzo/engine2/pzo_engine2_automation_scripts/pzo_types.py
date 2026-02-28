#!/usr/bin/env python3
"""pzo_types.py — TaskRecord dataclass for v4 NDJSON taskbooks.

All fields from task.schema.v3.json + v4 additions (notes with embedded prompts).
The notes field is the most important field — it contains the actual TypeScript
code the model must write, embedded as a spec-level prompt by the taskbook generator.

Version: 2.0.0 (2026-02-27)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class TaskRecord:
    # ── Identity ────────────────────────────────────────────────────────────
    task_id:     str
    engine_id:   str
    engine_name: str
    phase_id:    str
    phase_name:  str
    sprint:      str

    # ── Description ─────────────────────────────────────────────────────────
    title:     str
    task_type: str
    mode:      str

    # ── Execution config ─────────────────────────────────────────────────────
    status:       str
    priority:     str
    worker_tier:  str
    worker_model: str
    timeout_s:    int
    retries:      int
    risk_level:   str
    estimated_points: int

    # ── Dependencies + outputs ───────────────────────────────────────────────
    depends_on:   tuple = field(default_factory=tuple)
    target_files: tuple = field(default_factory=tuple)

    # ── Quality gates ────────────────────────────────────────────────────────
    acceptance_criteria:  tuple = field(default_factory=tuple)
    validation_commands:  tuple = field(default_factory=tuple)

    # ── Operational metadata ─────────────────────────────────────────────────
    automation_tags: tuple = field(default_factory=tuple)
    tags:            tuple = field(default_factory=tuple)

    # ── Guard logic (v4 critical fields) ─────────────────────────────────────
    if_exists:    str = ""   # What to do if target file already exists
    if_missing:   str = ""   # Remediation if prerequisite absent
    rollback_plan: str = ""  # How to undo this task on failure

    # ── THE MOST IMPORTANT FIELD ──────────────────────────────────────────────
    # notes contains the FULL spec-level prompt including exact TypeScript code.
    # The runner MUST inject this into every LLM prompt.
    notes: str = ""

    @staticmethod
    def from_json(d: Dict[str, Any]) -> "TaskRecord":
        def _tup(v) -> tuple:
            if isinstance(v, (list, tuple)):
                return tuple(str(x) for x in v)
            return ()

        return TaskRecord(
            task_id       = str(d.get("task_id", "")),
            engine_id     = str(d.get("engine_id", "")),
            engine_name   = str(d.get("engine_name", "")),
            phase_id      = str(d.get("phase_id", "")),
            phase_name    = str(d.get("phase_name", "")),
            sprint        = str(d.get("sprint", "")),
            title         = str(d.get("title", "")),
            task_type     = str(d.get("task_type", "implementation")),
            mode          = str(d.get("mode", "build_v4")),
            status        = str(d.get("status", "pending")),
            priority      = str(d.get("priority", "P1")),
            worker_tier   = str(d.get("worker_tier", "L1")),
            worker_model  = str(d.get("worker_model", "phi3:mini")),
            timeout_s     = int(d.get("timeout_s", 150)),
            retries       = int(d.get("retries", 1)),
            risk_level    = str(d.get("risk_level", "medium")),
            estimated_points = int(d.get("estimated_points", 2)),
            depends_on    = _tup(d.get("depends_on")),
            target_files  = _tup(d.get("target_files")),
            acceptance_criteria = _tup(d.get("acceptance_criteria")),
            validation_commands = _tup(d.get("validation_commands")),
            automation_tags = _tup(d.get("automation_tags")),
            tags            = _tup(d.get("tags")),
            if_exists     = str(d.get("if_exists", "")),
            if_missing    = str(d.get("if_missing", "")),
            rollback_plan = str(d.get("rollback_plan", "")),
            notes         = str(d.get("notes", "")),
        )
