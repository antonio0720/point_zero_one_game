#!/bin/bash

log_info() {
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [INFO] $*"
}

log_success() {
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [SUCCESS] $*"
}

log_error() {
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [ERROR] $*" >&2
}

log_warn() {
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [WARN] $*"
}
