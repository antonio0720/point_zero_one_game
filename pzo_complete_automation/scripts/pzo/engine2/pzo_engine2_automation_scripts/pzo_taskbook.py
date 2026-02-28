#!/usr/bin/env python3
"""pzo_taskbook.py — Load v4 single-file NDJSON taskbook + topological dependency resolver.

V4 CHANGE: The taskbook is ONE .ndjson file, not a directory with frontend/backend splits.
Old code expected a directory with manifest + frontend/backend files — that is gone.

Features:
  - Direct single-file NDJSON load (v4 default)
  - Legacy directory-based discovery still works if needed
  - Topological ready-queue: returns tasks whose deps are all completed
  - Phase-group summary for monitor/progress display
  - Dependency graph validation (detects missing deps, cycles via DFS)

Version: 2.0.0 (2026-02-27)
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set, Tuple

from pzo_types import TaskRecord


@dataclass
class LoadResult:
    path: Path
    tasks: List[TaskRecord]
    warnings: List[str]

    @property
    def total(self) -> int:
        return len(self.tasks)

    def task_map(self) -> Dict[str, TaskRecord]:
        return {t.task_id: t for t in self.tasks}

    def phase_groups(self) -> Dict[str, List[TaskRecord]]:
        """Returns {phase_key: [tasks]} in phase order."""
        groups: Dict[str, List[TaskRecord]] = {}
        for t in self.tasks:
            key = f"{t.phase_id}:{t.phase_name}"
            groups.setdefault(key, []).append(t)
        return groups


def load_taskbook(path: Path) -> LoadResult:
    """Load a single v4 .ndjson taskbook file.

    Args:
        path: Absolute path to the .ndjson file.

    Returns:
        LoadResult with all tasks in stable parse order.

    Raises:
        FileNotFoundError, ValueError on bad input.
    """
    path = path.expanduser().resolve()
    if not path.exists():
        raise FileNotFoundError(f"Taskbook not found: {path}")
    if not path.suffix.lower() == ".ndjson":
        raise ValueError(f"Expected .ndjson file, got: {path.name}")

    tasks: List[TaskRecord] = []
    warnings: List[str] = []

    with path.open("r", encoding="utf-8") as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid NDJSON at line {lineno}: {e}") from e

            if not d.get("task_id"):
                warnings.append(f"Line {lineno}: missing task_id — skipped")
                continue

            tasks.append(TaskRecord.from_json(d))

    if not tasks:
        warnings.append("Taskbook loaded 0 tasks — is the file empty?")

    # Validate dependencies
    known_ids = {t.task_id for t in tasks}
    for t in tasks:
        for dep in t.depends_on:
            if dep and dep not in known_ids:
                warnings.append(f"{t.task_id}: unknown dependency '{dep}'")

    return LoadResult(path=path, tasks=tasks, warnings=warnings)


# ── Legacy directory-based loader (backward compat with old scripts) ──────────

def load_taskbooks_from_dir(taskbook_dir: Path, scope: str = "all") -> LoadResult:
    """Legacy: scan a directory for .ndjson taskbooks (v3 style).

    Prefers manifest-based discovery. Falls back to filename patterns.
    """
    taskbook_dir = taskbook_dir.expanduser().resolve()
    if not taskbook_dir.exists():
        raise FileNotFoundError(f"Taskbook dir not found: {taskbook_dir}")

    # Prefer any file matching v4 naming convention first
    v4_candidates = sorted(taskbook_dir.glob("*taskbook*.ndjson"), key=lambda p: p.stat().st_mtime, reverse=True)
    if v4_candidates:
        return load_taskbook(v4_candidates[0])

    # Fall back to v3 frontend+backend split
    all_tasks: List[TaskRecord] = []
    warnings: List[str] = []
    used_path = taskbook_dir

    patterns_by_scope = {
        "frontend": ["*tasks*frontend*.ndjson", "*frontend*.ndjson"],
        "backend":  ["*tasks*backend*.ndjson",  "*backend*.ndjson"],
        "all":      ["*.ndjson"],
    }
    patterns = patterns_by_scope.get(scope, ["*.ndjson"])
    seen: Set[str] = set()

    for pat in patterns:
        for fpath in sorted(taskbook_dir.glob(pat)):
            if fpath.name in seen:
                continue
            seen.add(fpath.name)
            sub = load_taskbook(fpath)
            all_tasks.extend(sub.tasks)
            warnings.extend(sub.warnings)

    # Dedup + stable sort by task_id numeric suffix
    deduped = list({t.task_id: t for t in all_tasks}.values())
    deduped.sort(key=_task_sort_key)

    return LoadResult(path=used_path, tasks=deduped, warnings=warnings)


def _task_sort_key(t: TaskRecord) -> Tuple:
    m = re.search(r"(\d+)$", t.task_id)
    prefix = t.task_id[:m.start()] if m else t.task_id
    num    = int(m.group(1)) if m else 10**12
    return (prefix, num, t.task_id)


# ── Topological queue ─────────────────────────────────────────────────────────

def topo_ready(
    tasks:            List[TaskRecord],
    completed:        Set[str],
    failed_blocking:  Set[str],
) -> List[TaskRecord]:
    """Return tasks whose ALL dependencies are satisfied (completed) and none are failed-blocking.

    A task is "failed-blocking" when it is a phase gate (audit/validation with gate tag)
    that failed — all downstream tasks are suspended until the gate is retried and passes.

    Non-gate failures do NOT block dependents (retries can proceed in parallel).
    """
    ready: List[TaskRecord] = []
    for t in tasks:
        if t.task_id in completed:
            continue
        blocked = False
        for dep in t.depends_on:
            if not dep:
                continue
            if dep in failed_blocking:
                blocked = True
                break
            if dep not in completed:
                blocked = True
                break
        if not blocked:
            ready.append(t)
    return ready


def detect_cycles(tasks: List[TaskRecord]) -> List[List[str]]:
    """DFS cycle detection. Returns list of cycles (each a list of task_ids)."""
    task_map = {t.task_id: t for t in tasks}
    visited:   Set[str] = set()
    rec_stack: Set[str] = set()
    cycles: List[List[str]] = []
    path: List[str] = []

    def dfs(tid: str) -> None:
        visited.add(tid)
        rec_stack.add(tid)
        path.append(tid)
        t = task_map.get(tid)
        if t:
            for dep in t.depends_on:
                if dep not in task_map:
                    continue
                if dep not in visited:
                    dfs(dep)
                elif dep in rec_stack:
                    # Found cycle: extract it
                    start = path.index(dep)
                    cycles.append(path[start:] + [dep])
        path.pop()
        rec_stack.discard(tid)

    for t in tasks:
        if t.task_id not in visited:
            dfs(t.task_id)
    return cycles
