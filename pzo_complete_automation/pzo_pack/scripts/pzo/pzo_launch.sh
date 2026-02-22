#!/usr/bin/env bash
# ============================================================
# PZO BUILD LAUNCHER — starts pzo-build tmux session
# NEVER touches road-to-1200 session
# ============================================================
set -euo pipefail

PZO_ROOT="${PZO_ROOT:-/Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master}"
SCRIPT_DIR="$PZO_ROOT/pzo_complete_automation/scripts/pzo"
SESSION="pzo-build"
CMD="${1:-run}"

# ─── SAFETY CHECK ─────────────────────────────────────────────
if tmux has-session -t "road-to-1200" 2>/dev/null; then
  echo "✅ road-to-1200 is alive — not touching it."
fi

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "⚠️  Session $SESSION already running."
  echo "   Attach:  tmux attach -t $SESSION"
  echo "   Kill:    tmux kill-session -t $SESSION"
  exit 0
fi

# ─── LAUNCH ───────────────────────────────────────────────────
echo "🚀 Starting $SESSION..."

tmux new-session -d -s "$SESSION" -n "runner"
tmux send-keys -t "$SESSION:runner" "cd $PZO_ROOT/pzo_complete_automation" C-m
tmux send-keys -t "$SESSION:runner" "echo '=== PZO SOVEREIGN AUTOMATION PROTOCOL v1.3 ===' " C-m
tmux send-keys -t "$SESSION:runner" "bash $SCRIPT_DIR/pzo_taskbook_runner.sh $CMD 2>&1 | tee -a runtime/logs/taskbook/runner_\$(date +%Y%m%d_%H%M%S).log" C-m

# Window 2: Status monitor (auto-refreshes every 30s)
tmux new-window -t "$SESSION" -n "status"
tmux send-keys -t "$SESSION:status" "cd $PZO_ROOT/pzo_complete_automation" C-m
tmux send-keys -t "$SESSION:status" "watch -n 30 'bash $SCRIPT_DIR/pzo_taskbook_runner.sh status'" C-m

# Window 3: Log tail
tmux new-window -t "$SESSION" -n "logs"
tmux send-keys -t "$SESSION:logs" "cd $PZO_ROOT/pzo_complete_automation" C-m
tmux send-keys -t "$SESSION:logs" "tail -f runtime/logs/taskbook/*.log 2>/dev/null || sleep 5 && tail -f runtime/logs/taskbook/*.log" C-m

# Focus runner window
tmux select-window -t "$SESSION:runner"

echo ""
echo "════════════════════════════════════════════════════"
echo "  PZO BUILD SESSION STARTED"
echo "════════════════════════════════════════════════════"
echo ""
echo "  Attach:       tmux attach -t $SESSION"
echo "  Status:       tmux attach -t $SESSION:status"
echo "  Logs:         tmux attach -t $SESSION:logs"
echo ""
echo "  road-to-1200: UNTOUCHED ✅"
echo ""
echo "  Commands from any terminal:"
echo "  PHASE_FILTER=PZO_P01_ENGINE_UPGRADE bash $SCRIPT_DIR/pzo_taskbook_runner.sh run"
echo "  START_FROM=PZO_T00050 bash $SCRIPT_DIR/pzo_taskbook_runner.sh resume"
echo "  DRY_RUN=1 bash $SCRIPT_DIR/pzo_taskbook_runner.sh run"
echo ""
