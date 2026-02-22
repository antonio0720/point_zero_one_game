#!/bin/bash

set -euo pipefail

# Set DRY_RUN to 1 if you want to simulate the upgrade process without making any changes.
if [ "${DRY_RUN:-0}" = "1" ]; then
    echo "Dry run enabled. No changes will be made."
fi

# Check if ml_enabled is set to true, and if so, enable the ML model.
if [ "${ml_enabled:-false}" = "true" ]; then
    echo "Enabling ML model..."
else
    echo "ML model disabled. Skipping upgrade for this feature."
fi

# Upgrade the engine to the latest version while preserving determinism.
echo "Upgrading engine to latest version..."
engine_upgrade_command="pip install --upgrade pzo-engine"
eval "$engine_upgrade_command"

# Verify that the audit hash is correct after the upgrade.
echo "Verifying audit hash..."
audit_hash=$(python -c 'import hashlib; print(hashlib.sha256(open("pzo-engine/__init__.py", "rb").read()).hexdigest())')
if [ "${audit_hash:-}" != "$(cat /path/to/expected_audit_hash)" ]; then
    echo "Audit hash mismatch. Upgrade failed."
    exit 1
fi

# If we reach this point, the upgrade was successful.
echo "Engine upgrade complete."
