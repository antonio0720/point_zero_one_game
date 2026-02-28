#!/usr/bin/env python3
"""pzo_watchdog_engine2.py — external watchdog for Engine 2 runner.

Polls every WATCHDOG_POLL_S seconds:
  1. Runner PID alive? If dead → restart
  2. Heartbeat file age > HEARTBEAT_STALE_S? → kill + restart (deadlock recovery)
  3. Log file last-written age > LOG_STALE_S? → kill + restart (silent hang)
  4. Writes watchdog state JSON so monitor can display restart count + last reason

Writes:
  runtime/pzo_engine2_watchdog.json  — live watchdog status

Version: 2.0.0 (2026-02-27)
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

from pzo_config import (
    DEFAULT_REPO_ROOT,
    DEFAULT_TASKBOOK_PATH,
    HEARTBEAT_PATH,
    HEARTBEAT_STALE_S,
    LOG_PATH,
    LOG_STALE_S,
    WATCHDOG_PATH,
    WATCHDOG_POLL_S,
)


def _utc_iso() -> str:
    import datetime as _dt
    return _dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def _pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def _heartbeat_age_s(path: Path) -> float:
    """Returns seconds since last heartbeat write. Returns infinity if missing."""
    try:
        if not path.exists():
            return float("inf")
        data = json.loads(path.read_text(encoding="utf-8"))
        epoch = float(data.get("epoch_s", 0))
        return time.time() - epoch
    except Exception:
        return float("inf")


def _log_age_s(path: Path) -> float:
    try:
        if not path.exists():
            return float("inf")
        return time.time() - path.stat().st_mtime
    except Exception:
        return float("inf")


def _kill_runner(pid: int, reason: str) -> None:
    print(f"[WATCHDOG] Killing PID {pid} — reason: {reason}", flush=True)
    try:
        os.kill(pid, signal.SIGTERM)
        time.sleep(3)
        if _pid_alive(pid):
            os.kill(pid, signal.SIGKILL)
    except Exception as e:
        print(f"[WATCHDOG] Kill error: {e}", flush=True)


def _start_runner(script_dir: Path, taskbook: Path, repo_root: Path) -> subprocess.Popen:
    runner = script_dir / "pzo_runner_engine2.py"
    cmd = [
        sys.executable, str(runner),
        "--taskbook",  str(taskbook),
        "--repo-root", str(repo_root),
    ]
    print(f"[WATCHDOG] Starting runner: {' '.join(cmd)}", flush=True)
    p = subprocess.Popen(cmd, cwd=str(script_dir))
    print(f"[WATCHDOG] Runner started PID={p.pid}", flush=True)
    return p


def _write_watchdog_state(
    path: Path,
    runner_pid: Optional[int],
    restarts: int,
    last_reason: str,
    hb_age_s: float,
    status: str,
) -> None:
    data = {
        "watchdog_utc":  _utc_iso(),
        "runner_pid":    runner_pid,
        "restarts":      restarts,
        "last_reason":   last_reason,
        "hb_age_s":      round(hb_age_s, 1),
        "status":        status,
    }
    try:
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
        os.replace(tmp, path)
    except Exception:
        pass


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--taskbook",   default=str(DEFAULT_TASKBOOK_PATH))
    ap.add_argument("--repo-root",  default=str(DEFAULT_REPO_ROOT))
    ap.add_argument("--poll-s",     type=int, default=WATCHDOG_POLL_S)
    args = ap.parse_args()

    script_dir  = Path(__file__).resolve().parent
    taskbook    = Path(args.taskbook).expanduser().resolve()
    repo_root   = Path(args.repo_root).expanduser().resolve()
    WATCHDOG_PATH.parent.mkdir(parents=True, exist_ok=True)

    print(f"[WATCHDOG] Starting — poll_interval={args.poll_s}s "
          f"hb_stale={HEARTBEAT_STALE_S}s log_stale={LOG_STALE_S}s", flush=True)

    runner_proc: Optional[subprocess.Popen] = None
    restarts    = 0
    last_reason = "initial_start"

    # Initial start
    runner_proc = _start_runner(script_dir, taskbook, repo_root)

    while True:
        time.sleep(args.poll_s)

        pid = runner_proc.pid if runner_proc else None
        alive = (pid is not None) and _pid_alive(pid)
        hb_age = _heartbeat_age_s(HEARTBEAT_PATH)
        log_age = _log_age_s(LOG_PATH)

        restart_reason = None

        if not alive:
            rc = runner_proc.poll() if runner_proc else None
            restart_reason = f"runner_dead rc={rc}"
        elif hb_age > HEARTBEAT_STALE_S:
            restart_reason = f"heartbeat_stale {int(hb_age)}s > {HEARTBEAT_STALE_S}s (deadlock?)"
        elif log_age > LOG_STALE_S:
            restart_reason = f"log_stale {int(log_age)}s > {LOG_STALE_S}s (silent hang?)"

        if restart_reason:
            restarts += 1
            last_reason = restart_reason
            print(f"[WATCHDOG] RESTART #{restarts} — {restart_reason}", flush=True)
            if alive and pid:
                _kill_runner(pid, restart_reason)
            time.sleep(2)
            runner_proc = _start_runner(script_dir, taskbook, repo_root)
            pid = runner_proc.pid

        status = "healthy" if (alive and not restart_reason) else "restarting"
        _write_watchdog_state(WATCHDOG_PATH, pid, restarts, last_reason, hb_age, status)

        print(f"[WATCHDOG] ok pid={pid} hb_age={int(hb_age)}s restarts={restarts}", flush=True)


if __name__ == "__main__":
    raise SystemExit(main())
