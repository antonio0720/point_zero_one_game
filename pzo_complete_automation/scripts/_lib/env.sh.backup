#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/../../.env.local" ]; then
    source "$SCRIPT_DIR/../../.env.local"
fi

# CRITICAL FIX: Set PZO_ROOT to the pzo_complete_automation directory
export PZO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
export PZO_RUNTIME="$PZO_ROOT/docs/pzo1/runtime"
export PZO_QUEUE="$PZO_RUNTIME/task_queue"
export PZO_LOGS="$PZO_RUNTIME/logs"
export NOTIFY_PHONE="${NOTIFY_PHONE:-+18604360540}"

mkdir -p "$PZO_RUNTIME"/{ledger,task_queue,logs,artifacts,bundles,checkpoints}

export PZO_ENV_LOADED=true
