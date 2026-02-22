#!/usr/bin/env bash
# PZO DEPLOY STOP — kills pzo-deploy ONLY
# NEVER touches pzo-build or road-to-1200
set -euo pipefail

echo ""
echo "  🛑  PZO DEPLOY STOP"
echo "  ─────────────────────────────────────"

if tmux has-session -t "pzo-deploy" 2>/dev/null; then
  tmux kill-session -t "pzo-deploy"
  echo "  ✅  pzo-deploy: STOPPED"
else
  echo "  ○   pzo-deploy: was not running"
fi

echo ""
echo "  Active sessions:"
tmux ls 2>/dev/null || echo "  (none)"

echo ""
for safe in "road-to-1200" "pzo-build"; do
  if tmux has-session -t "$safe" 2>/dev/null; then
    echo "  ✅  $safe: STILL RUNNING (untouched)"
  fi
done
echo ""
