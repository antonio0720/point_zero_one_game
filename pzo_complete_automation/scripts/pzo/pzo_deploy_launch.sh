#!/usr/bin/env bash
# ============================================================
# PZO DEPLOY LAUNCHER — starts pzo-deploy tmux session
# NEVER touches pzo-build or road-to-1200
# ============================================================
set -euo pipefail

PZO_ROOT="${PZO_ROOT:-/Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master}"
AUTOMATION_DIR="$PZO_ROOT/pzo_complete_automation"
SCRIPT_DIR="$AUTOMATION_DIR/scripts/pzo"
SESSION="pzo-deploy"
CMD="${1:-run}"
TASKBOOK="$AUTOMATION_DIR/master_taskbook_PZO_DEPLOYMENT_HOW_TO_DEPLOY_v1_0.ndjson"

# ─── SAFETY CHECKS ────────────────────────────────────────────
echo ""
echo "  ⚡  PZO SOVEREIGN DEPLOYMENT LAUNCHER"
echo "  ─────────────────────────────────────"

# Confirm other sessions are untouched
for safe in "road-to-1200" "pzo-build"; do
  if tmux has-session -t "$safe" 2>/dev/null; then
    echo "  ✅  $safe: ALIVE — untouched"
  else
    echo "  ○   $safe: not running"
  fi
done

# Guard against duplicate deploy session
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo ""
  echo "  ⚠️  Session '$SESSION' already running."
  echo "      Attach:  tmux attach -t $SESSION"
  echo "      Stop:    bash $SCRIPT_DIR/pzo_deploy_stop.sh"
  exit 0
fi

# Verify taskbook exists
if [[ ! -f "$TASKBOOK" ]]; then
  echo ""
  echo "  ❌  Taskbook not found:"
  echo "      $TASKBOOK"
  echo ""
  echo "  Copy master_taskbook_PZO_DEPLOYMENT_HOW_TO_DEPLOY_v1_0.ndjson"
  echo "  to: $AUTOMATION_DIR/"
  exit 1
fi

TASK_COUNT=$(wc -l < "$TASKBOOK")
echo "  📋  Taskbook: $TASK_COUNT tasks"
echo ""

# ─── LAUNCH TMUX SESSION ──────────────────────────────────────
echo "  🚀  Starting '$SESSION'..."

# Window 1: Runner
tmux new-session -d -s "$SESSION" -n "runner"
tmux send-keys -t "$SESSION:runner" "cd $AUTOMATION_DIR" C-m
tmux send-keys -t "$SESSION:runner" "echo ''" C-m
tmux send-keys -t "$SESSION:runner" "echo '  ⚡  PZO DEPLOYMENT PROTOCOL — SOVEREIGN BUILD'" C-m
tmux send-keys -t "$SESSION:runner" "echo '  Session: $SESSION | Tasks: $TASK_COUNT | Mode: $CMD'" C-m
tmux send-keys -t "$SESSION:runner" "echo ''" C-m
tmux send-keys -t "$SESSION:runner" "export PZO_ROOT='$PZO_ROOT'" C-m
tmux send-keys -t "$SESSION:runner" "export TASKBOOK='$TASKBOOK'" C-m
tmux send-keys -t "$SESSION:runner" "bash $SCRIPT_DIR/pzo_deploy_runner.sh $CMD 2>&1 | tee -a runtime/logs/deploy/runner_\$(date +%Y%m%d_%H%M%S).log" C-m

# Window 2: Live monitor (python watch)
tmux new-window -t "$SESSION" -n "monitor"
tmux send-keys -t "$SESSION:monitor" "cd $AUTOMATION_DIR" C-m
tmux send-keys -t "$SESSION:monitor" "sleep 3 && watch -n 5 'python3 $SCRIPT_DIR/pzo_deploy_monitor.py'" C-m

# Window 3: Log tail
tmux new-window -t "$SESSION" -n "logs"
tmux send-keys -t "$SESSION:logs" "cd $AUTOMATION_DIR" C-m
tmux send-keys -t "$SESSION:logs" "echo 'Waiting for logs...' && sleep 4 && tail -f runtime/logs/deploy/*.log 2>/dev/null || (sleep 3 && tail -f runtime/logs/deploy/*.log)" C-m

# Window 4: Status + quick controls
tmux new-window -t "$SESSION" -n "ops"
tmux send-keys -t "$SESSION:ops" "cd $AUTOMATION_DIR" C-m
tmux send-keys -t "$SESSION:ops" "echo '=== PZO DEPLOY OPS WINDOW ==='" C-m
tmux send-keys -t "$SESSION:ops" "echo ''" C-m
tmux send-keys -t "$SESSION:ops" "echo 'Commands:'" C-m
tmux send-keys -t "$SESSION:ops" "echo '  bash $SCRIPT_DIR/pzo_deploy_runner.sh status'" C-m
tmux send-keys -t "$SESSION:ops" "echo '  bash $SCRIPT_DIR/pzo_deploy_runner.sh reset-crashes'" C-m
tmux send-keys -t "$SESSION:ops" "echo '  PHASE_FILTER=PZO_INFRA_FOUNDATION_V1 bash $SCRIPT_DIR/pzo_deploy_runner.sh run'" C-m
tmux send-keys -t "$SESSION:ops" "echo '  START_FROM=PZO_GAME_T001 bash $SCRIPT_DIR/pzo_deploy_runner.sh resume'" C-m
tmux send-keys -t "$SESSION:ops" "echo ''" C-m

# Focus runner window
tmux select-window -t "$SESSION:runner"

echo ""
echo "  ════════════════════════════════════════════════"
echo "  ✅  SESSION '$SESSION' STARTED"
echo "  ════════════════════════════════════════════════"
echo ""
echo "  Windows:"
echo "    runner  — main execution log"
echo "    monitor — live progress dashboard (5s refresh)"
echo "    logs    — raw log tail"
echo "    ops     — status + quick commands"
echo ""
echo "  Attach:     tmux attach -t $SESSION"
echo "  Monitor:    tmux attach -t $SESSION:monitor"
echo "  Stop:       bash $SCRIPT_DIR/pzo_deploy_stop.sh"
echo ""
echo "  Power commands:"
echo "  PHASE_FILTER=PZO_INFRA_FOUNDATION_V1 bash $SCRIPT_DIR/pzo_deploy_runner.sh run"
echo "  PHASE_FILTER=PZO_GAME_CORE_ENGINE_V1 bash $SCRIPT_DIR/pzo_deploy_runner.sh run"
echo "  START_FROM=PZO_GAME_T001 bash $SCRIPT_DIR/pzo_deploy_runner.sh resume"
echo "  DRY_RUN=1 bash $SCRIPT_DIR/pzo_deploy_runner.sh run"
echo ""
echo "  road-to-1200 + pzo-build: UNTOUCHED ✅"
echo ""
