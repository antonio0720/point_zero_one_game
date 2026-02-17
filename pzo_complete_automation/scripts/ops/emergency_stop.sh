#!/bin/bash
set -euo pipefail

echo "Stopping all automation..."

# Kill tmux session
tmux kill-session -t pzo-adam 2>/dev/null || true

# Kill any worker processes
pkill -f worker_loop.sh || true

echo "All stopped"
