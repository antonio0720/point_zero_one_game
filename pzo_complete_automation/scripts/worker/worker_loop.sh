#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/../_lib/env.sh"
source "$SCRIPT_DIR/../_lib/logging.sh"

log_info "Worker started"

while true; do
  if [ ! -f "$PZO_QUEUE/tasks.ndjson" ] || [ ! -s "$PZO_QUEUE/tasks.ndjson" ]; then
    log_info "Queue empty, exiting"
    exit 0
  fi
  
  task_json=$(head -1 "$PZO_QUEUE/tasks.ndjson")
  task_id=$(echo "$task_json" | jq -r '.task_id')
  
  if "$SCRIPT_DIR/task_runner.sh" "$task_json"; then
    log_success "Completed: $task_id"
    tail -n +2 "$PZO_QUEUE/tasks.ndjson" > "$PZO_QUEUE/tasks.ndjson.tmp"
    mv "$PZO_QUEUE/tasks.ndjson.tmp" "$PZO_QUEUE/tasks.ndjson"
  else
    log_error "Failed: $task_id"
    retry_count=$(echo "$task_json" | jq -r '.retry_count // 0')
    new_retry=$((retry_count + 1))
    
    if [ $new_retry -ge 6 ]; then
      log_error "Max retries for $task_id, skipping"
      tail -n +2 "$PZO_QUEUE/tasks.ndjson" > "$PZO_QUEUE/tasks.ndjson.tmp"
      mv "$PZO_QUEUE/tasks.ndjson.tmp" "$PZO_QUEUE/tasks.ndjson"
    else
      updated_task=$(echo "$task_json" | jq ".retry_count = $new_retry")
      tail -n +2 "$PZO_QUEUE/tasks.ndjson" > "$PZO_QUEUE/tasks.ndjson.tmp"
      echo "$updated_task" >> "$PZO_QUEUE/tasks.ndjson.tmp"
      mv "$PZO_QUEUE/tasks.ndjson.tmp" "$PZO_QUEUE/tasks.ndjson"
    fi
  fi
  
  sleep 1
done
