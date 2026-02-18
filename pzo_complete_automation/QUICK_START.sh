#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

echo "═══════════════════════════════════════════════════════════"
echo "   POINT ZERO ONE - AUTONOMOUS BUILD SYSTEM"
echo "   Setting up Adam to build everything 24/7..."
echo "═══════════════════════════════════════════════════════════"

chmod +x scripts/**/*.sh 2>/dev/null || true
chmod +x scripts/*/*.sh 2>/dev/null || true
find scripts -type f -name "*.sh" -exec chmod +x {} \;

source scripts/_lib/env.sh
source scripts/_lib/logging.sh

log_info "Bootstrapping Point Zero One..."
scripts/queue/seed_queue.sh || true

WORKER_COUNT=4
log_info "Starting $WORKER_COUNT workers..."

tmux kill-session -t pzo-adam 2>/dev/null || true
tmux new-session -d -s pzo-adam -n "worker-1"
tmux send-keys -t pzo-adam:worker-1 "cd $(pwd)" C-m
tmux send-keys -t pzo-adam:worker-1 "./scripts/worker/worker_loop.sh 2>&1 | tee -a $PZO_LOGS/worker-1.log" C-m

for i in 2 3 4; do
    tmux new-window -t pzo-adam -n "worker-$i"
    tmux send-keys -t pzo-adam:worker-$i "cd $(pwd)" C-m
    tmux send-keys -t pzo-adam:worker-$i "./scripts/worker/worker_loop.sh 2>&1 | tee -a $PZO_LOGS/worker-$i.log" C-m
    sleep 0.5
done

log_success "Bootstrap complete!"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "   ✅ ADAM IS NOW RUNNING 24/7 with $WORKER_COUNT workers"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Attach to tmux: tmux attach -t pzo-adam"
echo "  2. Watch logs: tail -f $PZO_LOGS/worker-*.log"
echo ""
echo "To detach from tmux: Press Ctrl+b, then d"
echo "To stop Adam: ./scripts/ops/emergency_stop.sh"
