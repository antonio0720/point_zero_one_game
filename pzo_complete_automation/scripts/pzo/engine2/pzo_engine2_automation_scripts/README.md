# PZO Engine 2 — Pressure Engine Automation Scripts v2

Sovereign automation stack for running the v4 taskbook against Ollama.

---

## Quick Start

```bash
export PZO_REPO_ROOT=/Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master
export PZO_TASKBOOK=/Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_complete_automation/scripts/pzo/engine2/pzo_engine2_pressure_taskbook_v4.ndjson

# Full tmux session (runner + monitor + watchdog + shell pane):
./pzo_tmux_engine2.sh

# Or direct launch (CI/cron):
./engine2_runner_cmd.sh
```

---

## File Map

| File | Purpose |
|---|---|
| `pzo_config.py` | Central config: tier map, paths, thresholds, deadlock rules |
| `pzo_types.py` | TaskRecord dataclass — all v4 NDJSON fields including `notes` |
| `pzo_taskbook.py` | Single-file NDJSON loader + topological dependency resolver |
| `pzo_ollama.py` | Deadlock-safe Ollama caller (5-vector protection) |
| `pzo_postprocess.py` | File-type aware output sanitizer (TS/CSS/JSON) |
| `pzo_state.py` | Atomic runner state + heartbeat + retry context storage |
| `pzo_fs.py` | Atomic file writes, backup, placeholder creation |
| `pzo_repo.py` | Repo root detection and absolute path resolution |
| `pzo_logging.py` | Structured JSONL logger with severity levels |
| `pzo_runner_engine2.py` | **Main runner** — orchestrates all of the above |
| `pzo_preflight.py` | Pre-run validation gate (Ollama, models, paths, cycles) |
| `pzo_watchdog_engine2.py` | External process watchdog (restarts dead/stalled runner) |
| `pzo_monitor.py` | Live terminal dashboard |
| `pzo_tmux_engine2.sh` | 4-pane tmux launcher (preflight → runner + monitor + watchdog) |
| `engine2_runner_cmd.sh` | Single-shot launcher for CI/cron |

---

## What Was Fixed (v1 → v2)

### CRITICAL Fixes

**1. Spec content was invisible to the model.**
`task.notes` contains the full TypeScript code spec embedded by the taskbook generator. In v1, `build_prompt_for_file()` never injected `notes` into the prompt — the model had zero implementation context. Fixed: `notes` is now injected as `=== IMPLEMENTATION SPEC ===` block.

**2. NameError crash on retry.**
v1 `main()` referenced `spec.retries` but `spec` was only defined inside `pick_tier()`. First retry of any task crashed the runner. Fixed: `pick_tier()` returns the full tier spec; retries read from `TIER_MAP` directly.

**3. Single-file taskbook not found.**
v1 `pzo_taskbook.py` expected a directory with `taskpack.manifest*.json` + frontend/backend split files. v4 is one `.ndjson` file. Fixed: `load_taskbook(path)` loads a single file directly; directory-based loader kept for backward compat.

**4. Wrong default taskbook path.**
v1 defaulted to `~/Downloads/Engines_Master/...`. v4 taskbook lives in `pzo_complete_automation/scripts/pzo/engine2/`. Fixed in `pzo_config.py`.

### HIGH Priority Fixes

**5. Shell-only tasks called LLM.**
`task_type='audit'` and `task_type='validation'` (typecheck gates) should run `validation_commands` only — no LLM. v1 called Ollama for everything. Fixed: `SHELL_ONLY_TASK_TYPES` routes to `execute_shell_task()`.

**6. `if_exists` / `if_missing` fields never read.**
These fields are in every v4 task but v1 ignored them. Fixed: runner checks `if_exists` to skip tasks where a real implementation already exists.

**7. Phase gate failures didn't block downstream.**
A failing typecheck gate should block ALL downstream tasks until it passes. v1 just marked the gate failed and kept going. Fixed: `is_gate_task()` detection + `gate_failures` set in state → `failed_blocking` in topo resolver.

**8. Context-blind retries.**
v1 sent the same generic prompt on retry. Fixed: on failure, runner stores `(stderr, validation_output, broken_file_content)` in `state.retry_context[task_id]`. On retry, the broken file + error are injected into the prompt as `=== RETRY CONTEXT ===`.

### MEDIUM Priority Fixes

**9. CSS files corrupted by TypeScript-only preamble stripper.**
v1 `sanitize_output()` stripped TypeScript-style preambles and applied TypeScript-only TODO detection to CSS output. Fixed: `pzo_postprocess.sanitize()` is file-type aware — different patterns for `.ts`/`.tsx`, `.css`, `.json`.

**10. Hardcoded wrong tmux paths.**
v1 `pzo_tmux_engine2.sh` hardcoded `~/Downloads/...` in `TASKBOOK_DIR`. Fixed: reads `PZO_TASKBOOK` env var with v4 default.

**11. Monitor crashed loading taskbook.**
v1 `pzo_monitor5.py` called `load_taskbooks(dir)` — crashed with v4 single-file path. Fixed: `pzo_monitor.py` calls `load_taskbook(path)`.

### LOW Priority Improvements

**12. Structured logging.** `pzo_logging.py` now writes JSONL with `{ts, level, task, msg}` — parseable by monitor for color-coded log tail. Severity levels: `DEBUG/INFO/WARN/ERROR/FATAL`.

**13. Phase-level progress tracking.** `pzo_state.py` now feeds phase completion data to monitor for accurate phase progress bars.

**14. Atomic state writes.** `save_state()` uses tmp+rename — no corrupt state file on crash.

**15. Dependency cycle detection.** `detect_cycles()` runs at startup and aborts before any task executes.

---

## Tier Map

| Tier | Model | Timeout | num_predict | Used For |
|---|---|---|---|---|
| L0 | phi3:mini | 90s | 1024 | Governance, preflight, scaffold, typecheck gates |
| L1 | phi3:mini | 150s | 2048 | Types, class shells, CSS, simple methods |
| L2 | phi3:mini | 300s | 2048 | Signals, hooks, React components, store handlers |
| L3 | qwen3:8b | 420s | 4096 | PressureEngine core, integration tests |

**Deadlock Rule**: `phi3:mini` must never exceed `num_predict=2048`. Exceeding this fills the OS pipe buffer (~64KB), causing curl and Python to deadlock permanently. Enforced at import time in `pzo_config.py`.

**Escalation**: L2 tasks that fail escalate to L3 (qwen3:8b) on attempt 2.

---

## ENV Vars

| Var | Default | Purpose |
|---|---|---|
| `PZO_REPO_ROOT` | (required) | Path to repo root containing `pzo-web/` |
| `PZO_TASKBOOK` | v4 path in config | Override taskbook path |
| `PZO_PYTHON` | `python3` | Python binary |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |
| `PZO_RESET_STATE` | `0` | Set to `1` to ignore saved state |
| `PZO_SKIP_PREFLIGHT` | `0` | Set to `1` to skip pre-flight (CI use) |
| `PZO_HEARTBEAT_STALE_S` | `600` | Seconds before watchdog considers runner stalled |
| `PZO_WATCHDOG_POLL_S` | `60` | Watchdog poll interval |

---

## Runtime Directory Layout

```
pzo_engine2_automation_scripts/
├── runtime/
│   ├── pzo_engine2_state.json       ← runner state (completed, failed, attempts, retry_context)
│   ├── pzo_engine2_heartbeat.json   ← runner liveness beacon (updated every 30s)
│   ├── pzo_engine2_watchdog.json    ← watchdog status (restarts, hb_age, last_reason)
│   ├── logs/
│   │   └── pzo_engine2_runner.log   ← JSONL structured log
│   └── outputs/
│       └── {task_id}__{file}.result.json  ← per-task evidence (model, timing, sha256)
```

---

## Dry Run (no Ollama calls, no file writes)

```bash
python3 pzo_runner_engine2.py \
  --taskbook "$PZO_TASKBOOK" \
  --repo-root "$PZO_REPO_ROOT" \
  --dry-run
```

Prints the full execution plan — task IDs, tiers, dependencies, phases — without touching any files.
