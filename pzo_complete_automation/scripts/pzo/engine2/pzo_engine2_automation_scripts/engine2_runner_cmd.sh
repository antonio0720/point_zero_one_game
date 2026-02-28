#!/usr/bin/env bash
# engine2_runner_cmd.sh — Direct runner launch (no tmux, no watchdog).
# Use this for CI, cron jobs, or single-shot automation.
#
# Required env vars:
#   PZO_REPO_ROOT   — path to repo containing pzo-web/
#
# Optional:
#   PZO_TASKBOOK    — override taskbook path
#   PZO_PYTHON      — python binary (default: python3)
#   PZO_SKIP_PREFLIGHT — set to "1" to skip preflight check
#   PZO_RESET_STATE    — set to "1" to start fresh (ignore saved state)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="${PZO_PYTHON:-python3}"

TASKBOOK="${PZO_TASKBOOK:-/Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_complete_automation/scripts/pzo/engine2/pzo_engine2_pressure_taskbook_v4.ndjson}"
REPO_ROOT="${PZO_REPO_ROOT:?ERROR: PZO_REPO_ROOT must be set}"

# Pre-flight (unless skipped)
if [[ "${PZO_SKIP_PREFLIGHT:-0}" != "1" ]]; then
    "$PYTHON" "$SCRIPT_DIR/pzo_preflight.py" \
        --taskbook "$TASKBOOK" \
        --repo-root "$REPO_ROOT" || {
        echo "Pre-flight failed — aborting"
        exit 1
    }
fi

# Build runner args
RUNNER_ARGS="--taskbook $TASKBOOK --repo-root $REPO_ROOT"
if [[ "${PZO_RESET_STATE:-0}" == "1" ]]; then
    RUNNER_ARGS="$RUNNER_ARGS --reset"
fi

exec "$PYTHON" "$SCRIPT_DIR/pzo_runner_engine2.py" $RUNNER_ARGS
