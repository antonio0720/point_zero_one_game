#!/usr/bin/env bash
# ============================================================
# PZO DEPLOY MONITOR LAUNCHER
# Opens pzo_deploy_monitor.py in watch mode (5s refresh)
# Can run standalone — does NOT need tmux
# ============================================================
set -euo pipefail

PZO_ROOT="${PZO_ROOT:-/Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master}"
AUTO_DIR="$PZO_ROOT/pzo_complete_automation"
MONITOR="$AUTO_DIR/scripts/pzo/pzo_deploy_monitor.py"

if [[ ! -f "$MONITOR" ]]; then
    echo "Monitor not found: $MONITOR"
    exit 1
fi

echo "Starting PZO Deploy Monitor (5s refresh)..."
echo "Ctrl+C to stop"
echo ""

# Pass paths via env for flexibility
export PZO_ROOT="$PZO_ROOT"
export PZO_DEPLOY_STATE="$AUTO_DIR/runtime/pzo_deploy_state.json"
export PZO_DEPLOY_TASKBOOK="$AUTO_DIR/master_taskbook_PZO_DEPLOYMENT_HOW_TO_DEPLOY_v1_0.ndjson"

watch -n 5 "PZO_ROOT='$PZO_ROOT' \
  PZO_DEPLOY_STATE='$AUTO_DIR/runtime/pzo_deploy_state.json' \
  PZO_DEPLOY_TASKBOOK='$AUTO_DIR/master_taskbook_PZO_DEPLOYMENT_HOW_TO_DEPLOY_v1_0.ndjson' \
  python3 '$MONITOR'"
