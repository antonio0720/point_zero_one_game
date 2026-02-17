#!/bin/bash
set -euo pipefail

source "$(dirname "$0")/../_lib/env.sh"

if tmux has-session -t pzo-adam 2>/dev/null; then
  echo "✓ tmux running"
else
  echo "✗ tmux not running"
  exit 1
fi

if pgrep -f worker_loop.sh > /dev/null; then
  echo "✓ worker running"
else
  echo "✗ worker not running"
  exit 1
fi

if [ -f "$PZO_QUEUE/tasks.ndjson" ]; then
  task_count=$(wc -l < "$PZO_QUEUE/tasks.ndjson")
  echo "✓ queue exists: $task_count tasks"
else
  echo "✗ queue missing"
  exit 1
fi

echo ""
echo "Current task: $(head -1 "$PZO_QUEUE/tasks.ndjson" 2>/dev/null | jq -r '.task_id' || echo 'none')"
echo "Last activity: $(tail -1 "$PZO_LOGS/worker.log" 2>/dev/null | cut -d' ' -f1-2 || echo 'no logs')"
