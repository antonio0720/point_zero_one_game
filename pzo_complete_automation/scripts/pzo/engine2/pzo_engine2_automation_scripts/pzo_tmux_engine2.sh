#!/usr/bin/env bash
# pzo_tmux_engine2.sh — Launch Engine 2 Pressure Engine automation in a tmux session.
#
# Creates 4 panes:
#   pane 0 (top-left, large): runner
#   pane 1 (top-right):       monitor (live dashboard)
#   pane 2 (bottom-left):     watchdog
#   pane 3 (bottom-right):    shell (for manual commands)
#
# Pre-run: executes preflight check — ABORTS if preflight fails.
#
# ENV VARS (all have defaults):
#   PZO_REPO_ROOT    — required, must contain pzo-web/
#   PZO_TASKBOOK     — override taskbook path (default = v4 path in config)
#   PZO_PYTHON       — python binary to use (default: python3)
#
# Usage:
#   export PZO_REPO_ROOT=/path/to/point_zero_one_master
#   ./pzo_tmux_engine2.sh
#
# Version: 2.0.0 (2026-02-27)

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
SESSION="pzo_engine2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="${PZO_PYTHON:-python3}"

# Taskbook path — override via env or use config default
TASKBOOK="${PZO_TASKBOOK:-/Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_complete_automation/scripts/pzo/engine2/pzo_engine2_pressure_taskbook_v4.ndjson}"

# Repo root — required
REPO_ROOT="${PZO_REPO_ROOT:-}"

# ── Validation ────────────────────────────────────────────────────────────────
if [[ -z "$REPO_ROOT" ]]; then
    echo "ERROR: PZO_REPO_ROOT is not set."
    echo "  Export it: export PZO_REPO_ROOT=/path/to/point_zero_one_master"
    exit 1
fi

if [[ ! -d "$REPO_ROOT/pzo-web" ]]; then
    echo "ERROR: PZO_REPO_ROOT='$REPO_ROOT' does not contain pzo-web/"
    exit 1
fi

if [[ ! -f "$TASKBOOK" ]]; then
    echo "ERROR: Taskbook not found: $TASKBOOK"
    echo "  Override: export PZO_TASKBOOK=/path/to/taskbook.ndjson"
    exit 1
fi

# ── Pre-flight ────────────────────────────────────────────────────────────────
echo ""
echo "Running pre-flight check..."
if ! "$PYTHON" "$SCRIPT_DIR/pzo_preflight.py" --taskbook "$TASKBOOK" --repo-root "$REPO_ROOT"; then
    echo ""
    echo "ERROR: Pre-flight failed — fix above errors before launching."
    exit 1
fi

echo ""
echo "Pre-flight passed. Launching tmux session: $SESSION"

# ── Tmux session ─────────────────────────────────────────────────────────────
# Kill existing session if present
tmux start-server 2>/dev/null || true
if tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "Killing existing session: $SESSION"
    tmux kill-session -t "$SESSION"
fi

# Commands
CMD_RUNNER="cd '$SCRIPT_DIR' && $PYTHON pzo_runner_engine2.py --taskbook '$TASKBOOK' --repo-root '$REPO_ROOT'; echo 'RUNNER EXITED — press Enter'; read"
CMD_MONITOR="cd '$SCRIPT_DIR' && sleep 2 && $PYTHON pzo_monitor.py --taskbook '$TASKBOOK'; echo 'MONITOR EXITED'; read"
CMD_WATCHDOG="cd '$SCRIPT_DIR' && sleep 3 && $PYTHON pzo_watchdog_engine2.py --taskbook '$TASKBOOK' --repo-root '$REPO_ROOT'; echo 'WATCHDOG EXITED'; read"
CMD_SHELL="cd '$REPO_ROOT' && echo 'Shell ready. REPO_ROOT=$REPO_ROOT' && bash"

# Create session with runner in pane 0
tmux new-session -d -s "$SESSION" -x 220 -y 50 "$BASH" -c "$CMD_RUNNER"

# Split right → monitor
tmux split-window -h -t "$SESSION:0" "$BASH" -c "$CMD_MONITOR"

# Select left pane, split down → watchdog
tmux select-pane -t "$SESSION:0.0"
tmux split-window -v -t "$SESSION:0.0" "$BASH" -c "$CMD_WATCHDOG"

# Select right pane, split down → shell
tmux select-pane -t "$SESSION:0.2"
tmux split-window -v -t "$SESSION:0.2" "$BASH" -c "$CMD_SHELL"

# Give runner pane more space
tmux resize-pane -t "$SESSION:0.0" -x 120

# Select runner pane
tmux select-pane -t "$SESSION:0.0"

# Attach
tmux attach-session -t "$SESSION"
