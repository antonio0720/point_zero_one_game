#!/bin/bash
set -euo pipefail

task_type="$1"
retry_count="${2:-0}"

case $retry_count in
  0) echo "mistral:7b" ;;
  1) echo "llama3.1:8b" ;;
  2) echo "qwen2.5:7b" ;;
  3) echo "llama3.1:8b" ;;
  4) echo "qwen2.5:14b" ;;
  5) echo "qwen2.5:32b" ;;
  *) echo "mistral:7b" ;;
esac
