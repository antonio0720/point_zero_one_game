#!/usr/bin/env python3
"""pzo_runner_engine2.py — Engine 2 Pressure Engine task runner v2.

WHAT'S FIXED vs v1:
  CRITICAL: task.notes now INJECTED into every LLM prompt (spec code was invisible to model)
  CRITICAL: NameError on 'spec' in retry block — fixed by returning spec from pick_tier()
  CRITICAL: Single-file NDJSON taskbook loading (v4 format — not directory-based)
  CRITICAL: Correct absolute path in DEFAULT_TASKBOOK
  HIGH:     Shell-only task path for audit/validation/scaffold — no LLM called
  HIGH:     if_exists/if_missing fields now honored
  HIGH:     Phase gate failures hard-block ALL dependents (not just mark failed)
  HIGH:     Context-aware retry — resends broken file + validation error + stderr
  MEDIUM:   File-type-aware postprocessing (CSS/JSON not corrupted)

ARCHITECTURE:
  - Single NDJSON taskbook → topological queue → execute in dependency order
  - Each task routed by task_type: shell-only vs LLM-generate
  - LLM prompt = title + acceptance_criteria + task.notes (contains spec TypeScript)
  - On failure: store context (broken file + error) → retry with context injected
  - Phase gates (typecheck tasks): failure hard-blocks ALL tasks that depend on them
  - L2 tasks escalate to qwen3:8b on first retry
  - Heartbeat every 30s; watchdog monitors heartbeat age

Version: 2.0.0 (2026-02-27)
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from pzo_config import (
    DEFAULT_REPO_ROOT,
    DEFAULT_TASKBOOK_PATH,
    HEARTBEAT_PATH,
    LOG_PATH,
    OUTPUTS_DIR,
    RUNTIME_DIR,
    STATE_PATH,
    TIER_MAP,
    L2_ESCALATION_TIER,
    SHELL_ONLY_TASK_TYPES,
    is_gate_task,
)
from pzo_fs import atomic_write_text, backup_file, ensure_dir, ensure_placeholder_ts, read_file_safe, sha256_file
from pzo_logging import Logger
from pzo_ollama import call_ollama
from pzo_postprocess import sanitize
from pzo_repo import repo_path, resolve_repo_root
from pzo_state import RunnerState, heartbeat_loop, load_state, save_state
from pzo_taskbook import detect_cycles, load_taskbook, topo_ready
from pzo_types import TaskRecord


# ── Utilities ──────────────────────────────────────────────────────────────────

def _utc_iso() -> str:
    import datetime as _dt
    return _dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def run_shell(cmd: str, cwd: Path, log: Logger, timeout_s: int = 120) -> Tuple[int, str, str]:
    """Run a shell command with timeout. Returns (rc, stdout, stderr)."""
    log.debug(f"[CMD] {cmd}")
    try:
        p = subprocess.Popen(
            cmd, cwd=str(cwd), shell=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        )
        out, err = p.communicate(timeout=timeout_s)
        return (p.returncode or 0), out.strip(), err.strip()
    except subprocess.TimeoutExpired:
        try:
            p.kill()
            p.communicate(timeout=2)
        except Exception:
            pass
        return 124, "", f"command_timeout after {timeout_s}s"
    except Exception as e:
        return 1, "", str(e)


# ── Tier + escalation ──────────────────────────────────────────────────────────

def pick_tier(task: TaskRecord, state: RunnerState) -> Tuple[str, str, int, int]:
    """Return (tier_name, model, timeout_s, num_predict).

    Escalation policy:
      - L2 on attempt >= 2: escalate to L3 (qwen3:8b)
      - L0/L1 on attempt >= 3: escalate to L2
      - Never exceed TIER_MAP ceiling
    """
    attempts = int(state.attempts.get(task.task_id, 0))
    tier     = task.worker_tier or "L1"

    if attempts >= 2 and tier == "L2":
        tier = L2_ESCALATION_TIER
    elif attempts >= 3 and tier in ("L0", "L1"):
        tier = "L2"

    spec = TIER_MAP.get(tier) or TIER_MAP["L1"]
    return tier, spec.model, spec.timeout_s, spec.num_predict


# ── Prompt construction ────────────────────────────────────────────────────────

def build_prompt(task: TaskRecord, target_file: str, existing: Optional[str],
                 retry_ctx: Dict[str, str]) -> str:
    """Build the complete LLM prompt for a file generation task.

    CRITICAL FIX: task.notes is injected here. In v4 taskbooks, notes contains
    the full TypeScript code spec the model must implement. Without this,
    the model has zero context about what to write.
    """
    ac_block = "\n".join(f"  - {c}" for c in task.acceptance_criteria) or "  (none)"
    vc_block = "\n".join(f"  - {c}" for c in task.validation_commands) or "  (none)"

    existing_block = ""
    if existing:
        existing_block = (
            "\n\n=== EXISTING FILE (update/rewrite to satisfy acceptance criteria) ===\n"
            f"{existing}\n"
            "=== END EXISTING FILE ===\n"
        )

    retry_block = ""
    if retry_ctx:
        parts = []
        if retry_ctx.get("validation_output"):
            parts.append(f"VALIDATION ERRORS:\n{retry_ctx['validation_output']}")
        if retry_ctx.get("stderr"):
            parts.append(f"STDERR:\n{retry_ctx['stderr']}")
        if retry_ctx.get("broken_file"):
            parts.append(f"BROKEN FILE WRITTEN LAST ATTEMPT:\n{retry_ctx['broken_file']}")
        if parts:
            retry_block = (
                "\n\n=== RETRY CONTEXT (previous attempt failed — fix these errors) ===\n"
                + "\n\n".join(parts)
                + "\n=== END RETRY CONTEXT ===\n"
            )

    # task.notes is the SPEC — it contains exact TypeScript code to implement
    notes_block = f"\n\n=== IMPLEMENTATION SPEC ===\n{task.notes}\n=== END SPEC ===\n" if task.notes else ""

    return f"""You are a TypeScript/React engineer generating production code for the Point Zero One game engine.

OUTPUT RULES (non-negotiable):
- Output ONLY the complete, final file content. Nothing else.
- NO markdown fences, NO explanations, NO prose commentary.
- NO TODO/FIXME/HACK placeholders.
- Preserve existing exports unless the task explicitly changes them.
- TypeScript strict mode: all types explicit, no implicit any.
- Imports must be correct relative paths.

TARGET FILE: {target_file}

TASK [{task.task_id}]: {task.title}

ACCEPTANCE CRITERIA:
{ac_block}

VALIDATION COMMANDS (runner will execute after writing):
{vc_block}{notes_block}{existing_block}{retry_block}
OUTPUT THE COMPLETE FILE NOW:"""


# ── Task execution ─────────────────────────────────────────────────────────────

def execute_shell_task(task: TaskRecord, repo_root: Path, state: RunnerState, log: Logger) -> bool:
    """Execute a shell-only task (audit, validation, scaffold, filesystem_scaffold).

    No LLM is called. Runs validation_commands and/or if_missing logic.
    """
    log.info(f"[SHELL] {task.task_id} type={task.task_type}")

    # Scaffold: create dirs + placeholder files
    if task.task_type in ("filesystem_scaffold", "scaffold"):
        for rel in task.target_files:
            abs_path = repo_path(repo_root, rel)
            abs_path.parent.mkdir(parents=True, exist_ok=True)
            ensure_placeholder_ts(abs_path)
            log.debug(f"  scaffold: {abs_path}")

    # Run validation commands
    all_ok = True
    combined_output = []
    for cmd in task.validation_commands:
        rc, out, err = run_shell(cmd, repo_root, log, timeout_s=120)
        combined_output.append(f"$ {cmd}\nrc={rc}\n{out}\n{err}".strip())
        if rc != 0:
            log.warn(f"[SHELL_FAIL] {task.task_id} rc={rc} cmd={cmd}")
            all_ok = False
            # Store for context-aware retry
            state.store_retry_context(
                task.task_id,
                stderr=err,
                validation_output="\n".join(combined_output),
            )

    return all_ok


def execute_llm_task(task: TaskRecord, repo_root: Path, state: RunnerState, log: Logger) -> bool:
    """Execute a file-generation task: call LLM, sanitize, write, validate."""
    tier, model, timeout_s, num_predict = pick_tier(task, state)
    log.info(f"[LLM] {task.task_id} tier={tier} model={model} timeout={timeout_s}s np={num_predict}")

    retry_ctx = state.get_retry_context(task.task_id)
    all_ok = True

    for rel in task.target_files:
        abs_path = repo_path(repo_root, rel)
        existing = read_file_safe(abs_path, max_bytes=8000)

        # if_exists: skip if file already has a real implementation
        if existing and task.if_exists:
            if_exists = task.if_exists.lower()
            if "skipped_existing" in if_exists or "skip" in if_exists:
                if len(existing.strip()) > 100:  # real implementation, not a placeholder
                    log.info(f"[SKIP] {task.task_id} file={abs_path.name} — existing implementation retained")
                    continue

        prompt = build_prompt(task, rel, existing, retry_ctx)

        log.debug(f"  calling ollama: file={abs_path.name} prompt_chars={len(prompt)}")
        result = call_ollama(
            prompt=prompt,
            model=model,
            timeout_s=timeout_s,
            num_predict=num_predict,
            temperature=0.2,
            log_fn=log.log,
        )

        # Evidence record
        evidence: Dict = {
            "task_id":   task.task_id,
            "file":      rel,
            "tier":      tier,
            "model":     model,
            "timeout_s": timeout_s,
            "num_predict": num_predict,
            "ok":        result.ok,
            "rc":        result.rc,
            "duration_s": round(result.duration_s, 2),
            "utc":       _utc_iso(),
        }

        if not result.ok:
            evidence["failure"] = result.failure_reason
            evidence["stderr"]  = result.stderr[:500]
            _save_evidence(task.task_id, abs_path.name, evidence)
            state.store_retry_context(task.task_id, stderr=result.stderr, broken_file="")
            log.error(f"[LLM_FAIL] {task.task_id} file={abs_path.name} reason={result.failure_reason}")
            all_ok = False
            continue

        # Sanitize output
        post = sanitize(result.text, filename=abs_path.name, task_type=task.task_type)
        evidence["postprocess_ok"]     = post.ok
        evidence["postprocess_reason"] = post.reason

        if not post.ok:
            evidence["failure"] = "postprocess_failed"
            _save_evidence(task.task_id, abs_path.name, evidence)
            state.store_retry_context(
                task.task_id,
                stderr=result.stderr,
                broken_file=result.text[:4000],
                validation_output=f"postprocess_reason: {post.reason}",
            )
            log.error(f"[POSTPROCESS_FAIL] {task.task_id} reason={post.reason}")
            all_ok = False
            continue

        # Backup existing file before overwrite
        if abs_path.exists():
            backup_file(abs_path)

        # Atomic write
        atomic_write_text(abs_path, post.text)
        state.last_written = str(abs_path)
        save_state(STATE_PATH, state)

        try:
            evidence["sha256"] = sha256_file(abs_path)
            evidence["bytes"]  = abs_path.stat().st_size
        except Exception:
            pass
        _save_evidence(task.task_id, abs_path.name, evidence)
        log.info(f"[WRITTEN] {abs_path.name} {evidence.get('bytes',0)} bytes")

    if not all_ok:
        return False

    # Run validation commands
    combined_output = []
    for cmd in task.validation_commands:
        rc, out, err = run_shell(cmd, repo_root, log, timeout_s=300)
        combined_output.append(f"$ {cmd}\nrc={rc}\n{out}\n{err}".strip())
        if rc != 0:
            # Capture broken file content for retry context
            broken = ""
            if task.target_files:
                try:
                    broken = read_file_safe(repo_path(repo_root, task.target_files[0]), max_bytes=4000) or ""
                except Exception:
                    pass
            state.store_retry_context(
                task.task_id,
                stderr=err,
                validation_output="\n".join(combined_output),
                broken_file=broken,
            )
            log.warn(f"[VALIDATION_FAIL] {task.task_id} rc={rc} cmd={cmd}")
            log.debug(f"  stderr: {err[:300]}")
            return False

    # All validations passed — clear retry context
    state.retry_context.pop(task.task_id, None)
    return True


def execute_task(task: TaskRecord, repo_root: Path, state: RunnerState, log: Logger) -> bool:
    """Route task to shell-only or LLM path. Returns True on success."""
    t0 = time.time()
    task_log = log.child(task.task_id)
    state.current_task = task.task_id
    save_state(STATE_PATH, state)

    try:
        if task.task_type in SHELL_ONLY_TASK_TYPES:
            ok = execute_shell_task(task, repo_root, state, task_log)
        else:
            ok = execute_llm_task(task, repo_root, state, task_log)
    except Exception as e:
        state.crashes += 1
        state.store_retry_context(task.task_id, stderr=str(e))
        task_log.error(f"[EXCEPTION] {e}", exc=str(e))
        ok = False

    elapsed = round(time.time() - t0, 1)

    if ok:
        state.completed.append(task.task_id)
        state.task_times.append(elapsed)
        state.current_task = ""
        # Clear from failed if previously failed
        state.failed = [x for x in state.failed if x != task.task_id]
        state.failure_reasons.pop(task.task_id, None)
        state.clear_gate_failure(task.task_id)
        save_state(STATE_PATH, state)
        task_log.info(f"[DONE] {elapsed}s")
    else:
        if task.task_id not in state.failed:
            state.failed.append(task.task_id)
        state.failure_reasons[task.task_id] = state.failure_reasons.get(task.task_id, "") or "task_failed"
        # Phase gate failure: hard-block all dependents
        if is_gate_task(task):
            state.mark_gate_failed(task.task_id)
            task_log.error(f"[GATE_FAIL] phase gate failed — dependents hard-blocked until this passes")
        save_state(STATE_PATH, state)
        task_log.error(f"[FAIL] {elapsed}s attempt={state.attempts.get(task.task_id)}")

    return ok


def _save_evidence(task_id: str, filename: str, evidence: dict) -> None:
    try:
        ensure_dir(OUTPUTS_DIR)
        out_path = OUTPUTS_DIR / f"{task_id}__{filename}.result.json"
        out_path.write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    except Exception:
        pass


# ── Main loop ──────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(description="PZO Engine 2 task runner")
    ap.add_argument("--taskbook",    default=str(DEFAULT_TASKBOOK_PATH),
                    help="Path to v4 .ndjson taskbook file")
    ap.add_argument("--repo-root",   default=str(DEFAULT_REPO_ROOT),
                    help="Repo root containing pzo-web/")
    ap.add_argument("--idle-sleep",  type=int, default=8,
                    help="Seconds to sleep when no runnable tasks")
    ap.add_argument("--max-fail-streak", type=int, default=10,
                    help="Consecutive failures before cooldown pause")
    ap.add_argument("--dry-run",     action="store_true",
                    help="Print task execution plan without calling Ollama or writing files")
    ap.add_argument("--resume",      action="store_true", default=True,
                    help="Resume from saved state (default: True)")
    ap.add_argument("--reset",       action="store_true",
                    help="Ignore saved state — start fresh")
    args = ap.parse_args()

    # ── Setup ─────────────────────────────────────────────────────────────────
    ensure_dir(RUNTIME_DIR)
    ensure_dir(OUTPUTS_DIR)
    log = Logger(LOG_PATH)
    log.banner("ENGINE2 RUNNER v2 START")

    # Resolve repo root
    try:
        repo_root = resolve_repo_root(args.repo_root, os.getenv("PZO_REPO_ROOT", ""))
        log.info(f"repo_root={repo_root}")
    except RuntimeError as e:
        log.fatal(str(e))
        return 1

    # Load taskbook
    taskbook_path = Path(args.taskbook).expanduser().resolve()
    log.info(f"taskbook={taskbook_path}")
    try:
        loaded = load_taskbook(taskbook_path)
    except (FileNotFoundError, ValueError) as e:
        log.fatal(str(e))
        return 1

    tasks = loaded.tasks
    log.info(f"loaded {loaded.total} tasks  warnings={len(loaded.warnings)}")
    for w in loaded.warnings:
        log.warn(f"  taskbook_warning: {w}")

    # Cycle detection
    cycles = detect_cycles(tasks)
    if cycles:
        for cycle in cycles:
            log.error(f"[CYCLE] dependency cycle: {' -> '.join(cycle)}")
        log.fatal("Dependency cycles detected — fix taskbook before running")
        return 1

    # Dry run: just print plan
    if args.dry_run:
        log.info("=== DRY RUN — task execution plan ===")
        for t in tasks:
            deps = ",".join(t.depends_on) or "(none)"
            log.info(f"  {t.task_id} [{t.worker_tier}] {t.phase_id} | {t.title[:60]} | deps={deps}")
        log.info(f"Total: {len(tasks)} tasks")
        return 0

    # Load or reset state
    if args.reset:
        state = RunnerState()
        log.info("state RESET — starting fresh")
    else:
        state = load_state(STATE_PATH)
        already_done = len(state.completed)
        log.info(f"state loaded: completed={already_done} failed={len(state.failed)} "
                 f"gate_failures={len(state.gate_failures)} run_uuid={state.run_uuid}")

    # Heartbeat background thread
    hb_stop = threading.Event()
    hb_thread = threading.Thread(
        target=heartbeat_loop,
        args=(hb_stop, HEARTBEAT_PATH, state, os.getpid()),
        daemon=True,
    )
    hb_thread.start()

    fail_streak = 0
    total = len(tasks)

    try:
        while True:
            completed      = state.completed_set()
            gate_failures  = state.gate_failed_set()

            # Gate-failed tasks block ALL downstream tasks (not just immediate dependents)
            # by being in failed_blocking. Regular failures are NOT in failed_blocking.
            failed_blocking = gate_failures

            ready = topo_ready(tasks, completed, failed_blocking)

            done_count = len(completed)
            log.debug(f"[TICK] done={done_count}/{total} ready={len(ready)} "
                      f"gate_failures={len(gate_failures)} fail_streak={fail_streak}")

            if not ready:
                if done_count >= total:
                    state.current_task = "DONE"
                    save_state(STATE_PATH, state)
                    log.banner(f"ALL {total} TASKS COMPLETE")
                    # Linger briefly then exit
                    time.sleep(5)
                    return 0

                # No runnable tasks: either all blocked or all done
                blocked_count = sum(
                    1 for t in tasks
                    if t.task_id not in completed
                    and any(d in failed_blocking for d in t.depends_on)
                )
                log.warn(
                    f"[IDLE] no runnable tasks — "
                    f"done={done_count} blocked_by_gate={blocked_count} "
                    f"gate_failures={list(gate_failures)[:5]}"
                )
                time.sleep(max(15, args.idle_sleep))
                continue

            progressed = False
            for task in ready:
                if task.task_id in completed:
                    continue

                # Increment attempt counter
                attempts = int(state.attempts.get(task.task_id, 0)) + 1
                state.attempts[task.task_id] = attempts
                save_state(STATE_PATH, state)

                ok = execute_task(task, repo_root, state, log)

                if ok:
                    progressed = True
                    fail_streak = 0
                else:
                    fail_streak += 1
                    # Check retry budget
                    tier_spec = TIER_MAP.get(task.worker_tier, TIER_MAP["L1"])
                    max_retries = tier_spec.retries
                    if attempts <= max_retries:
                        log.info(f"[RETRY] {task.task_id} attempt={attempts}/{max_retries} "
                                 f"(context-aware retry with error injected)")
                        # Don't sleep — retry immediately with context
                        # Task stays NOT in completed, will be picked up next loop
                    else:
                        log.error(f"[EXHAUSTED] {task.task_id} — no retries left (attempt={attempts})")

                time.sleep(0.1)  # brief pause between task executions

            if not progressed:
                if fail_streak >= args.max_fail_streak:
                    log.warn(f"[COOLDOWN] fail_streak={fail_streak} — sleeping 30s")
                    time.sleep(30)
                    fail_streak = 0
                else:
                    time.sleep(args.idle_sleep)

    except KeyboardInterrupt:
        log.info("[INTERRUPTED] keyboard interrupt — saving state")
        save_state(STATE_PATH, state)
        return 130

    finally:
        hb_stop.set()
        try:
            hb_thread.join(timeout=3)
        except Exception:
            pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
