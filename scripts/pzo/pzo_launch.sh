#!/usr/bin/env bash

# Set strict mode and safe defaults
set -euo pipefail

# Define constants for tmux session name and window names
SESSION_NAME="pzo-build"
WINDOW_NAMES=("runner" "status" "logs")

# Check if DRY_RUN is set, if so exit early
if [ "${DRY_RUN:-false}" = true ]; then
  echo "Dry run: skipping launch"
  exit 0
fi

# Create tmux session if it doesn't exist
tmux has-session -t "$SESSION_NAME" || tmux new-session -s "$SESSION_NAME"

# Attach to existing session or create a new one
if [ "${START_FROM:-false}" = true ]; then
  tmux attach-session -t "$SESSION_NAME"
else
  tmux new-window -n "runner"
fi

# Create additional windows if needed
for window_name in "${WINDOW_NAMES[@]:1}"; do
  tmux new-window -n "$window_name"
done

# Set window layout and synchronize panes
tmux select-layout -t "$SESSION_NAME" main-horizontal
tmux set-option -g pane-active-border-status off
tmux set-option -g status-position top
tmux set-option -g status-justify "left"

# Run the game engine in the runner window
tmux send-keys -t "${WINDOW_NAMES[0]}" "node scripts/pzo/pzo.js" C-m

# Set PHASE_FILTER environment variable if provided
if [ -n "${PHASE_FILTER:-}" ]; then
  tmux set-environment -t "${WINDOW_NAMES[0]}" PHASE_FILTER "$PHASE_FILTER"
fi

# Run the game engine in the runner window with audit hash and ml_enabled kill-switch
tmux send-keys -t "${WINDOW_NAMES[0]}" "node scripts/pzo/pzo.js --audit-hash ${AUDIT_HASH:-} --ml-enabled=${ML_ENABLED:-false}" C-m

# Detach from tmux session
tmux detach-client
