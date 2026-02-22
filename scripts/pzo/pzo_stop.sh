#!/bin/bash

set -euo pipefail

# Set up logging
LOG_FILE="/tmp/pzo_stop.log"
exec 3>&1 4>>"$LOG_FILE"

# Verify that we're running in a PZO session
if [ "${PZO_SESSION_ID}" != "true" ]; then
    echo "Error: Not running within a PZO session." >&2
    exit 1
fi

# Stop the build process
pzo-build stop

# Check if road-to-1200 is still running after stopping the build process
if pgrep -f "road_to_1200" > /dev/null; then
    echo "Error: Road to 1200 is still running." >&2
    exit 1
fi

# Print session list
pzo-session list

# Log audit hash
audit_hash=$(echo "$RANDOM $LOG_FILE" | sha256sum)
echo "Audit Hash: $audit_hash"
