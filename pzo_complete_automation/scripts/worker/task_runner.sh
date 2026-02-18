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

# FIX #4: Separate prompts for different task types
case "$task_type" in
  create_structure)
    prompt="Task: $task_input. Output bash commands (mkdir -p, touch). No explanations."
    ;;
  create_module|create_contract|implement_feature)
    prompt="Task: $task_input. Output complete, production-ready code. No explanations, no markdown fences, no preamble. Code only."
    ;;
  create_test)
    prompt="Task: $task_input. Output complete test file with all imports and test cases. No explanations, no markdown. Code only."
    ;;
  create_docs)
    prompt="Task: $task_input. Output complete markdown documentation. No preamble."
    ;;
  *)
    prompt="Task: $task_input. Output code only. No explanations."
    ;;
esac

log_info "Calling Ollama: $model"

# FIX #3: Add 5-minute timeout protection
# FIX #2: Capture exit code to detect failures
set +e
ollama_output=$(timeout 300 ollama run "$model" "$prompt" 2>&1)
ollama_exit_code=$?
set -e

# FIX #2 & #9: Check for failures and empty output
if [ $ollama_exit_code -ne 0 ]; then
    log_error "Ollama execution failed (exit code: $ollama_exit_code)"
    echo "FAILED: Ollama timeout or error" > "$PZO_RUNTIME/artifacts/$task_id.txt"
    exit 1
fi

if [ -z "$ollama_output" ]; then
    log_error "Ollama returned empty output"
    echo "FAILED: Empty output" > "$PZO_RUNTIME/artifacts/$task_id.txt"
    exit 1
fi

if [[ "$ollama_output" == *"FAILED"* ]] || [[ "$ollama_output" == *"Error"* ]]; then
    log_error "Ollama returned error message"
    echo "$ollama_output" > "$PZO_RUNTIME/artifacts/$task_id.txt"
    exit 1
fi

# Save artifact
echo "$ollama_output" > "$PZO_RUNTIME/artifacts/$task_id.txt"
log_info "Artifact saved: $task_id.txt ($(wc -c < "$PZO_RUNTIME/artifacts/$task_id.txt") bytes)"

cd "$PZO_ROOT"

case "$task_type" in
  create_structure)
    echo "$ollama_output" | grep -E "^(mkdir|touch)" | while read cmd; do
      eval "$cmd" 2>/dev/null || true
    done
    ;;
  *)
    # FIX #1: Expanded regex to match ALL project paths and file types
    file_path=$(echo "$task_input" | grep -oE '(shared|backend|frontend|docs|infrastructure|internal|testing|scripts|docker)/[^ :,]+\.(ts|tsx|rs|md|sql|sh|json|py)' | head -1 || echo "")
    
    if [ -n "$file_path" ]; then
      mkdir -p "$(dirname "$file_path")"
      
      # Clean output: remove markdown fences if present
      cleaned_output=$(echo "$ollama_output" | sed '/^```/d')
      
      echo "$cleaned_output" > "$file_path"
      
      # FIX #7: Verify file was created and has content
      if [ -f "$file_path" ]; then
        file_size=$(wc -c < "$file_path")
        if [ "$file_size" -gt 0 ]; then
          log_success "Created: $file_path ($file_size bytes)"
        else
          log_error "File created but empty: $file_path"
          rm -f "$file_path"
          exit 1
        fi
      else
        log_error "Failed to create: $file_path"
        exit 1
      fi
    else
      log_warn "No file path found in task input, skipping file creation"
    fi
    ;;
esac

# Git commit (only if file was created successfully)
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  git add -A
  git commit -m "[$task_phase] $task_id" 2>/dev/null || true
fi

log_success "Task $task_id completed"
exit 0
