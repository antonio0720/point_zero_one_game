#!/usr/bin/env python3
"""pzo_monitor.py — live terminal dashboard for Engine 2 automation.

Renders every 3 seconds (configurable):
  ┌─ Overall progress bar + ETA + success rate + speed ──────────────────┐
  ├─ Phase breakdown (per-phase progress bar)                             │
  ├─ Tier breakdown (L0/L1/L2/L3 — done/total + fail count)              │
  ├─ Gate status (phase gates — PASS / FAIL / PENDING)                   │
  ├─ Watchdog status (restarts / hb_age / last_reason)                   │
  ├─ Recent log lines (last 8)                                            │
  └─ Currently executing task                                             │

Reads: pzo_engine2_state.json, pzo_engine2_heartbeat.json,
       pzo_engine2_watchdog.json, pzo_engine2_runner.log (JSONL),
       v4 taskbook (for phase/tier metadata)

Version: 2.0.0 (2026-02-27)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Tuple

from pzo_config import (
    DEFAULT_TASKBOOK_PATH,
    HEARTBEAT_PATH,
    HEARTBEAT_STALE_S,
    LOG_PATH,
    STATE_PATH,
    TIER_MAP,
    WATCHDOG_PATH,
)
from pzo_taskbook import load_taskbook

# ── ANSI ──────────────────────────────────────────────────────────────────────
R  = "\033[0m"
B  = "\033[1m"
DM = "\033[2m"
CY = "\033[1;36m"
GR = "\033[1;32m"
YE = "\033[1;33m"
RE = "\033[1;31m"
MA = "\033[1;35m"
BL = "\033[1;34m"
WH = "\033[1;37m"

W = 90  # terminal width


def _read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _pct_bar(pct: float, width: int = 30) -> str:
    pct = max(0.0, min(100.0, pct))
    filled = int(round(pct / 100 * width))
    bar = "█" * filled + "·" * (width - filled)
    color = GR if pct >= 100 else (YE if pct >= 50 else RE)
    return f"{color}{bar}{R}"


def _tail_log(path: Path, n: int = 8) -> List[str]:
    """Return last n lines from JSONL log, formatted for display."""
    lines: List[str] = []
    try:
        raw = path.read_text(encoding="utf-8", errors="replace").splitlines()
        for line in raw[-n:]:
            try:
                d = json.loads(line)
                level = d.get("level", "INFO")
                msg   = d.get("msg", line)
                ts    = d.get("ts", "")[-8:]  # HH:MM:SSZ
                color = GR if level == "INFO" else (YE if level == "WARN" else RE)
                tid   = f"[{d['task']}] " if d.get("task") else ""
                lines.append(f"  {DM}{ts}{R} {color}{level:5}{R} {tid}{msg[:70]}")
            except Exception:
                lines.append(f"  {DM}{line[:80]}{R}")
    except Exception:
        pass
    return lines


def _eta_str(done: int, total: int, task_times: List[float]) -> str:
    if done == 0 or not task_times:
        return "ETA: --:--"
    remaining = total - done
    avg = sum(task_times[-20:]) / len(task_times[-20:])
    secs = int(remaining * avg)
    if secs < 60:
        return f"ETA: {secs}s"
    elif secs < 3600:
        return f"ETA: {secs//60}m{secs%60:02d}s"
    else:
        return f"ETA: {secs//3600}h{(secs%3600)//60:02d}m"


def render(
    tasks_meta: List[Dict],
    state: dict,
    heartbeat: dict,
    watchdog: dict,
    refresh_n: int,
) -> str:
    lines: List[str] = []
    now = time.time()

    completed   = set(state.get("completed", []))
    failed      = set(state.get("failed", []))
    gate_fails  = set(state.get("gate_failures", []))
    task_times  = state.get("task_times", [])
    current     = state.get("current_task", "")
    last_written = Path(state.get("last_written", "")).name or "—"
    run_uuid    = state.get("run_uuid", "?")

    total = len(tasks_meta)
    done  = len(completed)
    fails = len(failed)
    pct   = (done / total * 100) if total else 0

    # ── Header ────────────────────────────────────────────────────────────────
    lines.append(f"{CY}{'═'*W}{R}")
    lines.append(f"{B}  PZO Engine 2 — Pressure Engine Monitor  {DM}run={run_uuid}  refresh=#{refresh_n}{R}")
    lines.append(f"{CY}{'═'*W}{R}")

    # ── Overall progress ──────────────────────────────────────────────────────
    bar = _pct_bar(pct, 40)
    speed = f"{len(task_times[-20:]) / max(1, sum(task_times[-20:])):.2f} tasks/s" if task_times else "—"
    eta   = _eta_str(done, total, task_times)
    sr    = f"{int(done/(done+fails)*100)}%" if (done + fails) > 0 else "—"
    lines.append(f"\n  {B}Overall{R}  {bar}  {GR}{done}{R}/{total}  {DM}{pct:.1f}%  fails={fails}  sr={sr}  {eta}  {speed}{R}")
    lines.append(f"  {DM}last_written: {last_written}{R}\n")

    # ── Phase breakdown ───────────────────────────────────────────────────────
    lines.append(f"  {B}{WH}Phases:{R}")
    phases: Dict[str, Tuple[int, int]] = {}
    for t in tasks_meta:
        ph = f"{t.get('phase_id','?')}:{t.get('phase_name','')[:20]}"
        d, tot = phases.get(ph, (0, 0))
        d += 1 if t.get("task_id") in completed else 0
        phases[ph] = (d, tot + 1)

    for ph, (d, tot) in phases.items():
        pct_ph = d / tot * 100
        bar_ph = _pct_bar(pct_ph, 20)
        mark = f"{GR}✓{R}" if d == tot else (f"{RE}✗{R}" if any(
            t.get("task_id") in failed for t in tasks_meta if f"{t.get('phase_id')}:{t.get('phase_name','')[:20]}" == ph
        ) else " ")
        lines.append(f"  {mark} {bar_ph}  {DM}{ph[:35]:36}{R} {GR}{d:2}{R}/{tot}")

    # ── Tier breakdown ────────────────────────────────────────────────────────
    lines.append(f"\n  {B}{WH}Tiers:{R}")
    tier_stats: Dict[str, Tuple[int, int, int]] = {}
    for t in tasks_meta:
        tier = t.get("worker_tier", "L?")
        d, tot, f = tier_stats.get(tier, (0, 0, 0))
        is_done = t.get("task_id") in completed
        is_fail = t.get("task_id") in failed
        tier_stats[tier] = (d + int(is_done), tot + 1, f + int(is_fail))

    for tier in sorted(tier_stats.keys()):
        d, tot, f = tier_stats[tier]
        spec = TIER_MAP.get(tier)
        model_str = f"{DM}{spec.model}{R}" if spec else ""
        bar_t = _pct_bar(d / tot * 100 if tot else 0, 16)
        lines.append(f"    {B}{tier}{R} {bar_t} {GR}{d:2}{R}/{tot} fails={RE}{f}{R} {model_str}")

    # ── Gate status ───────────────────────────────────────────────────────────
    gate_tasks = [t for t in tasks_meta if "gate" in (t.get("task_type","") + " ".join(t.get("automation_tags",[])).lower())]
    if gate_tasks:
        lines.append(f"\n  {B}{WH}Phase Gates:{R}")
        for t in gate_tasks:
            tid = t.get("task_id", "?")
            name = t.get("title", tid)[:50]
            if tid in completed:
                mark = f"{GR}✓ PASS{R}"
            elif tid in gate_fails:
                mark = f"{RE}✗ FAIL  ← BLOCKING DOWNSTREAM{R}"
            elif tid in failed:
                mark = f"{YE}↻ RETRY{R}"
            else:
                mark = f"{DM}● PENDING{R}"
            lines.append(f"    {mark}  {DM}{name}{R}")

    # ── Current task ──────────────────────────────────────────────────────────
    if current and current != "DONE":
        attempts = state.get("attempts", {}).get(current, "?")
        lines.append(f"\n  {B}Running:{R} {CY}{current}{R} (attempt={attempts})")
    elif current == "DONE":
        lines.append(f"\n  {GR}★  ALL TASKS COMPLETE  ★{R}")

    # ── Watchdog ──────────────────────────────────────────────────────────────
    lines.append(f"\n  {B}{WH}Watchdog:{R}")
    w_restarts  = watchdog.get("restarts", 0)
    w_last      = watchdog.get("last_reason", "—")
    w_hb_age    = watchdog.get("hb_age_s", "—")
    w_status    = watchdog.get("status", "unknown")
    w_pid       = watchdog.get("runner_pid", "—")
    w_color     = GR if w_status == "healthy" else YE
    lines.append(f"    status={w_color}{w_status}{R}  pid={w_pid}  restarts={YE}{w_restarts}{R}  "
                 f"hb_age={w_hb_age}s  last_reason={DM}{w_last}{R}")

    # ── Heartbeat ─────────────────────────────────────────────────────────────
    hb_epoch = float(heartbeat.get("epoch_s", 0))
    hb_age   = now - hb_epoch if hb_epoch else 0
    hb_color = GR if hb_age < 60 else (YE if hb_age < HEARTBEAT_STALE_S else RE)
    hb_task  = heartbeat.get("current_task", "—")
    lines.append(f"    heartbeat age={hb_color}{int(hb_age)}s{R}  task={DM}{hb_task}{R}")

    # ── Recent log ────────────────────────────────────────────────────────────
    lines.append(f"\n  {B}{WH}Recent Log:{R}")
    log_lines = _tail_log(LOG_PATH, n=8)
    lines.extend(log_lines if log_lines else [f"  {DM}(no log entries yet){R}"])

    # ── Footer ────────────────────────────────────────────────────────────────
    lines.append(f"\n{CY}{'─'*W}{R}")
    ts = time.strftime("%H:%M:%S UTC", time.gmtime())
    lines.append(f"  {DM}{ts}  Press Ctrl+C to exit monitor (runner continues){R}")

    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--taskbook",   default=str(DEFAULT_TASKBOOK_PATH))
    ap.add_argument("--interval",   type=float, default=3.0)
    args = ap.parse_args()

    taskbook_path = Path(args.taskbook).expanduser().resolve()

    # Load task metadata once (static)
    try:
        loaded = load_taskbook(taskbook_path)
        tasks_meta = [
            {
                "task_id":        t.task_id,
                "phase_id":       t.phase_id,
                "phase_name":     t.phase_name,
                "worker_tier":    t.worker_tier,
                "task_type":      t.task_type,
                "automation_tags": list(t.automation_tags),
                "title":          t.title,
            }
            for t in loaded.tasks
        ]
    except Exception as e:
        print(f"[MONITOR] Cannot load taskbook: {e}", file=sys.stderr)
        tasks_meta = []

    refresh_n = 0
    try:
        while True:
            state     = _read_json(STATE_PATH)
            heartbeat = _read_json(HEARTBEAT_PATH)
            watchdog  = _read_json(WATCHDOG_PATH)
            refresh_n += 1

            # Clear screen
            print("\033[H\033[2J", end="", flush=True)
            print(render(tasks_meta, state, heartbeat, watchdog, refresh_n), flush=True)

            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\n[MONITOR] Exiting (runner continues in background)")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
