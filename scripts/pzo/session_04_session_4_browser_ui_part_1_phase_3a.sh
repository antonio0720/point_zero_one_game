#!/bin/bash

set -euo pipefail

# Set DRY_RUN to 1 if you want to simulate the session without executing it
if [ "${DRY_RUN:-0}" = "1" ]; then
    echo "Dry run enabled. No changes will be made."
fi

# Print commands as we execute them for debugging purposes
set -x

# Set up the environment variables required by the game engine
export ML_ENABLED=0
export AUDIT_HASH="your_audit_hash_here"
export BOUNDED_OUTPUTS=true

# Run the session script (replace this with your actual session script)
./session_04_session_4_browser_ui_part_1_phase_3a.sh
