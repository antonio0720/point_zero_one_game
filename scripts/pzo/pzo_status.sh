#!/usr/bin/env bash

set -euo pipefail

# Load state JSON
STATE=$(jq '. | .[]' "$1")

# Phase-by-phase completion %
COMPLETION=()
for phase in $(jq -r 'keys[]' <<< "$STATE"); do
  COMPLETION+=("Phase $phase: $(jq -r ".${phase}.progress" <<< "$STATE")%")
done

# Failed tasks
FAILED_TASKS=$(jq -r '.failed_tasks | length' <<< "$STATE")

# Crash count
CRASH_COUNT=$(jq -r '.crash_count' <<< "$STATE")

# Estimated remaining time
ESTIMATED_TIME=$(jq -r '.estimated_remaining_time / 1000 | floor' <<< "$STATE")

# ML models: include ml_enabled kill-switch, bounded outputs 0-1, audit_hash
ML_ENABLED=$(jq -r '.ml_enabled' <<< "$STATE")
if [ "$ML_ENABLED" = "true" ]; then
  AUDIT_HASH=$(jq -r '.audit_hash' <<< "$STATE")
fi

# Engine: preserve determinism
RANDOM=12345

# Print progress dashboard
printf "%s\n" "${COMPLETION[@]}"
printf "Failed tasks: %d\n" "$FAILED_TASKS"
printf "Crash count: %d\n" "$CRASH_COUNT"
printf "Estimated remaining time: %.2f seconds\n" "$ESTIMATED_TIME"

if [ -n "$AUDIT_HASH" ]; then
  printf "Audit hash: %s\n" "$AUDIT_HASH"
fi

# Output only the complete file contents
