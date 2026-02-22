#!/usr/bin/env bash
# ============================================================
# QUICK START — PZO DEPLOYMENT AUTOMATION
# Launches the 1325-task deployment build in pzo-deploy tmux
# NEVER kills pzo-build or road-to-1200
# ============================================================
set -euo pipefail

PZO_ROOT="${PZO_ROOT:-/Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master}"
AUTO_DIR="$PZO_ROOT/pzo_complete_automation"
SCRIPTS="$AUTO_DIR/scripts/pzo"

echo ""
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║   ⚡  PZO DEPLOYMENT AUTOMATION — QUICK START    ║"
echo "  ║      1325 tasks · 52 phases · Session: pzo-deploy║"
echo "  ╚══════════════════════════════════════════════════╝"
echo ""

# ── PREFLIGHT ─────────────────────────────────────────────────
echo "  Checking setup..."

# Taskbook
TASKBOOK="$AUTO_DIR/master_taskbook_PZO_DEPLOYMENT_HOW_TO_DEPLOY_v1_0.ndjson"
if [[ -f "$TASKBOOK" ]]; then
    COUNT=$(wc -l < "$TASKBOOK")
    echo "  ✅  Taskbook: $COUNT tasks"
else
    echo "  ❌  Taskbook not found: $TASKBOOK"
    echo "      Copy master_taskbook_PZO_DEPLOYMENT_HOW_TO_DEPLOY_v1_0.ndjson to:"
    echo "      $AUTO_DIR/"
    exit 1
fi

# Ollama
if curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "  ✅  Ollama: running"
else
    echo "  ❌  Ollama not running."
    echo "      Start it: ollama serve &"
    exit 1
fi

# Scripts exist
for f in pzo_deploy_runner.sh pzo_deploy_launch.sh pzo_deploy_stop.sh pzo_deploy_monitor.py; do
    if [[ -f "$SCRIPTS/$f" ]]; then
        echo "  ✅  $f"
    else
        echo "  ❌  Missing: $SCRIPTS/$f"
        exit 1
    fi
done

# Make executable
chmod +x "$SCRIPTS"/*.sh 2>/dev/null || true

# Existing sessions
echo ""
for safe in "road-to-1200" "pzo-build"; do
    if tmux has-session -t "$safe" 2>/dev/null; then
        echo "  ✅  $safe: alive — untouched"
    fi
done

echo ""
echo "  ══════════════════════════════════════════════════"
echo "  Launching pzo-deploy session..."
echo "  ══════════════════════════════════════════════════"
echo ""

bash "$SCRIPTS/pzo_deploy_launch.sh" run
