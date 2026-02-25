#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# PZO ENGINE 1 — SOVEREIGN WATCHDOG
# Density6 LLC · RA-OMEGA
#
# Monitors the E1 runner. If log goes silent for >SILENCE_LIMIT seconds,
# kills the hung process and restarts it automatically.
#
# Run in a dedicated tmux pane:
#   tmux new-session -d -s pzo_watchdog "bash ~/pzo_scripts/pzo_watchdog.sh"
# ═══════════════════════════════════════════════════════════════════════════════

LOG=~/.pzo_e1_time_runner.log
RUNNER_SCRIPT="/Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_complete_automation/scripts/pzo/pzo_e1_time_runner.py"
PROJECT="/Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master"
TASKBOOK_DIR="/Users/mervinlarry/point_zero_one_master"

# Max silence before we assume a hang — set to longest possible task timeout + buffer
# L3 = 600s + 15s hard kill + 60s buffer = 675s. Round to 720.
SILENCE_LIMIT=720
CHECK_INTERVAL=60

echo "🐕 PZO Watchdog active"
echo "   Log:           $LOG"
echo "   Silence limit: ${SILENCE_LIMIT}s"
echo "   Check interval: ${CHECK_INTERVAL}s"
echo ""

while true; do
    sleep $CHECK_INTERVAL

    # ── Check if runner process is alive ──────────────────────────────────────
    if ! pgrep -f pzo_e1_time_runner.py > /dev/null 2>&1; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') ⚠️  Runner NOT running — starting now..."
        cd "$PROJECT" || exit 1
        nohup python3 "$RUNNER_SCRIPT" --project-root "$PROJECT" --taskbook "$PROJECT/pzo_complete_automation/tasks/ENGINE1_TIME_ENGINE_MASTER_TASK_PACK_V2.ndjson" >> "$LOG" 2>nohup python3 "$RUNNER_SCRIPT" >> "$LOG" 2>&11 &
        echo "$(date '+%Y-%m-%d %H:%M:%S') ✅ Runner started (pid $!)"
        sleep 15
        continue
    fi

    # ── Check log freshness ───────────────────────────────────────────────────
    if [ ! -f "$LOG" ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') ⚠️  Log file missing — skipping check"
        continue
    fi

    LAST_MOD=$(stat -f %m "$LOG" 2>/dev/null || echo 0)
    NOW=$(date +%s)
    AGE=$((NOW - LAST_MOD))

    if [ "$AGE" -gt "$SILENCE_LIMIT" ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') 🔴 HANG DETECTED — log silent for ${AGE}s (limit ${SILENCE_LIMIT}s)"
        echo "$(date '+%Y-%m-%d %H:%M:%S') 💀 Killing hung runner..."
        pkill -f pzo_e1_time_runner.py 2>/dev/null
        sleep 5
        pkill -9 -f pzo_e1_time_runner.py 2>/dev/null  # force if still alive
        sleep 3
        echo "$(date '+%Y-%m-%d %H:%M:%S') 🔄 Restarting runner..."
        cd "$PROJECT" || exit 1
        nohup python3 "$RUNNER_SCRIPT" --project-root "$PROJECT" --taskbook "$PROJECT/pzo_complete_automation/tasks/ENGINE1_TIME_ENGINE_MASTER_TASK_PACK_V2.ndjson" >> "$LOG" 2>nohup python3 "$RUNNER_SCRIPT" >> "$LOG" 2>&11 &
        echo "$(date '+%Y-%m-%d %H:%M:%S') ✅ Runner restarted (pid $!)"
        sleep 15
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S') ✅ Alive — log age ${AGE}s / ${SILENCE_LIMIT}s"
    fi
done
