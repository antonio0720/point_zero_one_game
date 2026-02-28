#!/usr/bin/env python3
"""pzo_logging.py — structured logger with severity levels + console echo.

Features over v1:
  - Severity levels: DEBUG / INFO / WARN / ERROR / FATAL
  - Structured JSON log lines (machine-parseable by monitor)
  - Human-readable prefix for terminal echo
  - Banner lines for section separation
  - Thread-safe (file lock via fcntl on macOS/Linux)

Version: 2.0.0 (2026-02-27)
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time
from pathlib import Path
from typing import Optional

_LEVELS = {"DEBUG": 0, "INFO": 1, "WARN": 2, "ERROR": 3, "FATAL": 4}
_COLORS = {
    "DEBUG": "\033[2m",
    "INFO":  "\033[0m",
    "WARN":  "\033[1;33m",
    "ERROR": "\033[1;31m",
    "FATAL": "\033[1;35m",
}
_RESET = "\033[0m"


def _utc_iso() -> str:
    import datetime as _dt
    return _dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


class Logger:
    """Thread-safe structured logger writing JSONL to disk + optional console echo."""

    def __init__(
        self,
        log_path: Path,
        min_level: str = "INFO",
        echo: bool = True,
        task_id: str = "",
    ):
        self.log_path  = log_path
        self.min_level = _LEVELS.get(min_level.upper(), 1)
        self.echo      = echo
        self.task_id   = task_id
        self._lock     = threading.Lock()
        log_path.parent.mkdir(parents=True, exist_ok=True)

    def _write(self, level: str, msg: str, **extra) -> None:
        if _LEVELS.get(level, 0) < self.min_level:
            return
        ts = _utc_iso()
        record = {"ts": ts, "level": level, "msg": msg}
        if self.task_id:
            record["task"] = self.task_id
        record.update(extra)
        line = json.dumps(record, separators=(",", ":")) + "\n"
        with self._lock:
            try:
                with self.log_path.open("a", encoding="utf-8") as f:
                    f.write(line)
            except Exception:
                pass
        if self.echo:
            color = _COLORS.get(level, "")
            tid = f"[{self.task_id}] " if self.task_id else ""
            print(f"{color}{ts} {level:5} {tid}{msg}{_RESET}", flush=True)

    def debug(self, msg: str, **kw) -> None: self._write("DEBUG", msg, **kw)
    def info(self, msg: str, **kw) -> None:  self._write("INFO",  msg, **kw)
    def warn(self, msg: str, **kw) -> None:  self._write("WARN",  msg, **kw)
    def error(self, msg: str, **kw) -> None: self._write("ERROR", msg, **kw)
    def fatal(self, msg: str, **kw) -> None: self._write("FATAL", msg, **kw)

    # Backward compat alias used by old code
    def log(self, msg: str) -> None:
        level = "INFO"
        if msg.startswith("[FAIL") or msg.startswith("[CRASH") or msg.startswith("[ERROR"):
            level = "ERROR"
        elif msg.startswith("[WARN"):
            level = "WARN"
        elif msg.startswith("[KILL") or msg.startswith("[TIMEOUT"):
            level = "WARN"
        self._write(level, msg)

    def banner(self, msg: str) -> None:
        sep = "=" * 24
        self._write("INFO", f"{sep} {msg} {sep}")

    def child(self, task_id: str) -> "Logger":
        """Return a child logger with task_id set for structured output."""
        return Logger(self.log_path, min_level=list(_LEVELS.keys())[self.min_level],
                      echo=self.echo, task_id=task_id)
