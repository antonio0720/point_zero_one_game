#!/bin/bash

set -euo pipefail

# Load master taskbook
master_taskbook=$(jq '.[] | {task_id, task_name}' < master_taskbook.ndjson)

# Iterate over tasks in master taskbook
for task in $master_taskbook; do
  # Check if Ollama is enabled for this task
  if [ "$(jq -r '.tasks[\"${task.task_id}\"] | .ollama_enabled' < ollama_config.json)" == "true" ]; then
    # Call Ollama per task
    output=$(ollama_per_task "$task")
    
    # Write files for this task
    write_files "$output"
  fi
done

# Crash-loop guard: restart if interrupted
while true; do
  # Check if we've been interrupted
  if [ -f crash_guard ]; then
    echo "Crash detected, restarting..."
    rm crash_guard
  else
    break
  fi
done

# Full resume: load last checkpoint and continue from there
checkpoint=$(jq '.[] | {task_id, task_name}' < checkpoint.ndjson)
if [ -n "$checkpoint" ]; then
  # Continue from the last checkpoint
  for task in $checkpoint; do
    # Check if Ollama is enabled for this task
    if [ "$(jq -r '.tasks[\"${task.task_id}\"] | .ollama_enabled' < ollama_config.json)" == "true" ]; then
      # Call Ollama per task
      output=$(ollama_per_task "$task")
      
      # Write files for this task
      write_files "$output"
    fi
  done
fi

# Never touch road-to-1200 session
if [ "$(jq -r '.road_to_1200' < ollama_config.json)" == "true" ]; then
  echo "Error: Cannot run on road-to-1200 session"
  exit 1
fi
