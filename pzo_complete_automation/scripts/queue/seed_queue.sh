#!/bin/bash
set -euo pipefail

source "$(dirname "$0")/../_lib/env.sh"

if [ -f "$PZO_QUEUE/tasks.ndjson" ] && [ -s "$PZO_QUEUE/tasks.ndjson" ]; then
  task_count=$(wc -l < "$PZO_QUEUE/tasks.ndjson")
  echo "Queue already contains $task_count tasks - not overwriting"
  exit 0
fi

echo "WARNING: Queue is empty"
exit 1
