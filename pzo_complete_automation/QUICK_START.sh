#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

echo "═══════════════════════════════════════════════════════════"
echo "   POINT ZERO ONE - AUTONOMOUS BUILD SYSTEM"
echo "   Setting up Adam to build everything 24/7..."
echo "═══════════════════════════════════════════════════════════"

# Make scripts executable
chmod +x scripts/**/*.sh 2>/dev/null || true
chmod +x scripts/*/*.sh 2>/dev/null || true
find scripts -type f -name "*.sh" -exec chmod +x {} \;

# Source environment
source scripts/_lib/env.sh
source scripts/_lib/logging.sh

log_info "Bootstrapping Point Zero One..."

# Seed queue
scripts/queue/seed_queue.sh || true

# Start tmux
tmux kill-session -t pzo-adam 2>/dev/null || true
tmux new-session -d -s pzo-adam
tmux send-keys -t pzo-adam "cd $(pwd)" C-m
tmux send-keys -t pzo-adam "./scripts/worker/worker_loop.sh 2>&1 | tee -a $PZO_LOGS/worker.log" C-m

log_success "Bootstrap complete!"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "   ✅ ADAM IS NOW RUNNING 24/7"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Attach to tmux: tmux attach -t pzo-adam"
echo "  2. Watch logs: tail -f $PZO_LOGS/worker.log"
echo ""
echo "To detach from tmux: Press Ctrl+b, then d"
echo "To stop Adam: ./scripts/ops/emergency_stop.sh"
