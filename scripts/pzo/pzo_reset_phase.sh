#!/bin/bash

set -euo pipefail

# Define a function to reset phase state
reset_phase() {
  local phase_id=$1
  local state=$(jq '.phases | .[] | select(.id == '$phase_id')' "$1")
  
  # Remove completed/failed status for the given phase
  if jq -e '.completed' <<< "$state" > /dev/null; then
    state=$(jq 'del(.completed)' <<< "$state")
  fi
  
  if jq -e '.failed' <<< "$state" > /dev/null; then
    state=$(jq 'del(.failed)' <<< "$state")
  fi
  
  # Update the phase in the state JSON with the new status
  local updated_state=$(jq ".phases[] | select(.id == $phase_id) |= $state" "$1")
  
  echo "$updated_state"
}

# Define a function to reset all phases
reset_all_phases() {
  local state=$(jq '.phases = []' "$1")
  echo "$state"
}
