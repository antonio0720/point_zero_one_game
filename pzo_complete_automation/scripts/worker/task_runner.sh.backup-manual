#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/../_lib/env.sh"
source "$SCRIPT_DIR/../_lib/logging.sh"

task_json="$1"
task_id=$(echo "$task_json" | jq -r '.task_id' 2>/dev/null || echo "UNKNOWN")
task_type=$(echo "$task_json" | jq -r '.type' 2>/dev/null || echo "unknown")
task_input=$(echo "$task_json" | jq -r '.input' 2>/dev/null || echo "")
task_phase=$(echo "$task_json" | jq -r '.phase' 2>/dev/null || echo "UNKNOWN")

# Skip if invalid JSON
if [ "$task_id" = "UNKNOWN" ] || [ -z "$task_input" ]; then
    log_error "Invalid task JSON, skipping"
    exit 1
fi

model=$("$SCRIPT_DIR/../router/route_task.sh" "$task_type" "$(echo "$task_json" | jq -r '.retry_count // 0')")

log_info "Task $task_id: $task_type"

mkdir -p "$PZO_RUNTIME/artifacts"

# Better prompts
case "$task_type" in
  create_structure)
    prompt="Task: $task_input. Output bash commands (mkdir -p, touch). No explanations."
    ;;
  create_module|create_contract|implement_feature)
    prompt="$task_input

Generate complete, production-ready code. Output ONLY the code with no explanations, no markdown fences, no preamble. Start directly with the code."
    ;;
  create_test)
    prompt="$task_input

Generate complete test file with all imports and test cases. Output ONLY the code with no explanations, no markdown fences. Start directly with the imports."
    ;;
  create_docs)
    prompt="$task_input

Generate complete markdown documentation. No preamble."
    ;;
  *)
    prompt="Task: $task_input. Output code only."
    ;;
esac

log_info "Calling Ollama: $model"

# Run Ollama with timeout
set +e
ollama_output=$(timeout 300 ollama run "$model" "$prompt" 2>&1)
ollama_exit_code=$?
set -e

# Check for actual failures (timeout or command error)
if [ $ollama_exit_code -eq 124 ]; then
    log_error "Ollama timeout (5 minutes)"
    echo "FAILED: Timeout" > "$PZO_RUNTIME/artifacts/$task_id.txt"
    exit 1
elif [ $ollama_exit_code -ne 0 ]; then
    log_error "Ollama execution failed (exit code: $ollama_exit_code)"
    echo "FAILED: Exit code $ollama_exit_code" > "$PZO_RUNTIME/artifacts/$task_id.txt"
    exit 1
fi

# Check for empty output
if [ -z "$ollama_output" ]; then
    log_error "Ollama returned empty output"
    echo "FAILED: Empty output" > "$PZO_RUNTIME/artifacts/$task_id.txt"
    exit 1
fi

# Save raw artifact
echo "$ollama_output" > "$PZO_RUNTIME/artifacts/$task_id.txt"

cd "$PZO_ROOT"

case "$task_type" in
  create_structure)
    echo "$ollama_output" | grep -E "^(mkdir|touch)" | while read cmd; do
      eval "$cmd" 2>/dev/null || true
    done
    ;;
  *)
    # Extract file path
    file_path=$(echo "$task_input" | grep -oE '(shared|backend|frontend|docs|infrastructure|internal|testing|scripts|docker)/[^ :,]+\.(ts|tsx|rs|md|sql|sh|json|py)' | head -1 || echo "")
    
    if [ -n "$file_path" ]; then
      mkdir -p "$(dirname "$file_path")"
      
      # Clean output: remove markdown fences and common preambles
      cleaned_output=$(echo "$ollama_output" | \
        sed '/^```/d' | \
        sed 's/^Here is.*://I' | \
        sed 's/^Below is.*://I' | \
        sed '/^$/d' | \
        awk 'NF {p=1} p')
      
      # Write cleaned output
      echo "$cleaned_output" > "$file_path"
      
      # Verify file was created and has content
      if [ -f "$file_path" ]; then
        file_size=$(wc -c < "$file_path" 2>/dev/null || echo 0)
        if [ "$file_size" -gt 10 ]; then
          log_success "Created: $file_path ($file_size bytes)"
        else
          log_error "File too small: $file_path ($file_size bytes)"
          rm -f "$file_path"
          exit 1
        fi
      else
        log_error "Failed to create: $file_path"
        exit 1
      fi
    else
      log_warn "No file path found in task input"
    fi
    ;;
esac

# Git commit
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  git add -A
  git commit -m "[$task_phase] $task_id" 2>/dev/null || true
fi

log_success "Task $task_id completed"
exit 0
