#!/usr/bin/env bash
# PZO STOP — kills pzo-build ONLY, never road-to-1200
set -euo pipefail

echo "🛑 Stopping pzo-build session..."

if tmux has-session -t "pzo-build" 2>/dev/null; then
  tmux kill-session -t "pzo-build"
  echo "✅ pzo-build stopped."
else
  echo "ℹ️  pzo-build was not running."
fi

echo ""
echo "Active tmux sessions:"
tmux ls 2>/dev/null || echo "(none)"

if tmux has-session -t "road-to-1200" 2>/dev/null; then
  echo ""
  echo "✅ road-to-1200: STILL RUNNING"
fi
