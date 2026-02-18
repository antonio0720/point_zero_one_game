#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/env.sh"
source "$SCRIPT_DIR/../_lib/logging.sh"

log_info "Worker started (PID: $$)"

# Random startup delay to prevent collision
sleep $(awk 'BEGIN{srand(); print rand() * 2}')

while true; do
  if [ ! -f "$PZO_QUEUE/tasks.ndjson" ] || [ ! -s "$PZO_QUEUE/tasks.ndjson" ]; then
    log_info "Queue empty, exiting"
    exit 0
  fi
  
  # Atomic claim: read first task
  task_json=$(head -1 "$PZO_QUEUE/tasks.ndjson" 2>/dev/null || echo "")
  
  if [ -z "$task_json" ]; then
    log_info "Queue empty, exiting"
    exit 0
  fi
  
  task_id=$(echo "$task_json" | jq -r '.task_id' 2>/dev/null || echo "UNKNOWN")
  
  # Remove from queue (atomic on macOS)
  tail -n +2 "$PZO_QUEUE/tasks.ndjson" > "$PZO_QUEUE/tasks.ndjson.tmp.$$" 2>/dev/null || continue
  mv "$PZO_QUEUE/tasks.ndjson.tmp.$$" "$PZO_QUEUE/tasks.ndjson" 2>/dev/null || continue
  
  log_info "Processing: $task_id"
  
  if "$SCRIPT_DIR/task_runner.sh" "$task_json"; then
    log_success "Completed: $task_id"
  else
    log_error "Failed: $task_id"
    retry_count=$(echo "$task_json" | jq -r '.retry_count // 0')
    new_retry=$((retry_count + 1))
    
    if [ $new_retry -ge 6 ]; then
      log_error "Max retries for $task_id, skipping"
    else
      log_warn "Retrying $task_id (attempt $new_retry/6)"
      updated_task=$(echo "$task_json" | jq ".retry_count = $new_retry")
      echo "$updated_task" >> "$PZO_QUEUE/tasks.ndjson"
    fi
  fi
  
  sleep 1
done
