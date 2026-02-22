#!/bin/bash

set -euo pipefail

# Load environment variables from .env file
export $(grep -v '^#' .env | xargs)

# Define a function to requeue failed tasks
requeue_failed_tasks() {
  local phase_filter=$1
  local state=$(jq '.state' <<< "$POZO_STATE")
  local failed_list=$(jq '.failed_list[]' <<< "$state")

  for task in "${failed_list[@]}"; do
    local task_id=$(jq -r '.id' <<< "$task")
    local retry_count=$(jq -r '.retry_count' <<< "$task")
    local audit_hash=$(jq -r '.audit_hash' <<< "$task")

    # Reset the retry count to 0
    jq ".tasks.$task_id.retry_count = 0" <<< "$POZO_STATE" > /tmp/state.json

    # Remove the task from the failed list in the state
    jq ".state.failed_list |= .[] | select(.id != \"$task_id\")" <<< "$POZO_STATE" > /tmp/state.json

    # Append the task to the run queue with optional phase filter
    if [ -n "$phase_filter" ]; then
      jq ".run_queue += [$task]" <<< "$POZO_STATE" > /tmp/state.json
    else
      jq ".run_queue += [$task]" <<< "$POZO_STATE" > /tmp/state.json
    fi

    # Update the state with the new run queue and failed list
    mv /tmp/state.json "$POZO_STATE"
  done
}

# Call the function to requeue failed tasks
requeue_failed_tasks "$1"

# Output the updated state as JSON
jq -n --argjson POZO_STATE "$POZO_STATE" '$POZO_STATE'
