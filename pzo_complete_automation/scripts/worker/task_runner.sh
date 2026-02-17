#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/../_lib/env.sh"
source "$SCRIPT_DIR/../_lib/logging.sh"

task_json="$1"
task_id=$(echo "$task_json" | jq -r '.task_id')
task_type=$(echo "$task_json" | jq -r '.type')
task_input=$(echo "$task_json" | jq -r '.input')
task_phase=$(echo "$task_json" | jq -r '.phase')

model=$("$SCRIPT_DIR/../router/route_task.sh" "$task_type" "$(echo "$task_json" | jq -r '.retry_count // 0')")

log_info "Task $task_id: $task_type"

mkdir -p "$PZO_RUNTIME/artifacts"

case "$task_type" in
  create_module|create_structure)
    prompt="Task: $task_input. Output bash commands (mkdir -p, touch). No explanations."
    ;;
  *)
    prompt="Task: $task_input. Output code only."
    ;;
esac

log_info "Calling Ollama: $model"
ollama_output=$(ollama run "$model" "$prompt" 2>&1 || echo "FAILED")

echo "$ollama_output" > "$PZO_RUNTIME/artifacts/$task_id.txt"

cd "$PZO_ROOT"

case "$task_type" in
  create_module|create_structure)
    echo "$ollama_output" | grep -E "^(mkdir|touch)" | while read cmd; do
      eval "$cmd" 2>/dev/null || true
    done
    ;;
  *)
    file_path=$(echo "$task_input" | grep -oE '(shared|backend|frontend|docs)/[^ :,]+\.(ts|rs|md|sql|sh|json)' | head -1 || echo "")
    if [ -n "$file_path" ]; then
      mkdir -p "$(dirname "$file_path")"
      echo "$ollama_output" > "$file_path"
      log_success "Created: $file_path"
    fi
    ;;
esac

if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  git add -A
  git commit -m "[$task_phase] $task_id" 2>/dev/null || true
fi

log_success "Task $task_id completed"
exit 0
