#!/bin/bash
# EMERGENCY FIX DEPLOYMENT - Point Zero One Worker Recovery
# Fixes JSON parsing bug causing UNKNOWN task failures

set -e

PROJECT_ROOT="/Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_complete_automation"

echo "════════════════════════════════════════════════"
echo "POINT ZERO ONE - EMERGENCY WORKER FIX"
echo "════════════════════════════════════════════════"
echo ""

cd "$PROJECT_ROOT"

# Backup current worker
echo "[1/5] Backing up current task_runner.sh..."
cp scripts/worker/task_runner.sh scripts/worker/task_runner.sh.backup-$(date +%Y%m%d-%H%M%S)
echo "✓ Backup created"

# Deploy fixed script
echo "[2/5] Deploying fixed task_runner.sh..."
cat > scripts/worker/task_runner.sh << 'EOFSCRIPT'
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/../_lib/env.sh"
source "$SCRIPT_DIR/../_lib/logging.sh"

task_json="$1"

# ROBUST JSON PARSING - extract all fields with safe defaults
task_id=$(echo "$task_json" | jq -r '.task_id // "UNKNOWN"' 2>/dev/null || echo "UNKNOWN")
task_type=$(echo "$task_json" | jq -r '.type // "unknown"' 2>/dev/null || echo "unknown")
task_input=$(echo "$task_json" | jq -r '.input // ""' 2>/dev/null || echo "")
task_phase=$(echo "$task_json" | jq -r '.phase // "UNKNOWN"' 2>/dev/null || echo "UNKNOWN")
retry_count=$(echo "$task_json" | jq -r '.retry_count // 0' 2>/dev/null || echo "0")

# Skip if invalid JSON
if [ "$task_id" = "UNKNOWN" ] || [ -z "$task_input" ]; then
    log_error "Invalid task JSON, skipping"
    exit 1
fi

# FIXED: Pass retry_count as extracted variable, not nested command substitution
model=$("$SCRIPT_DIR/../router/route_task.sh" "$task_type" "$retry_count")

log_info "Task $task_id: $task_type (retry: $retry_count)"

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
EOFSCRIPT

chmod +x scripts/worker/task_runner.sh
echo "✓ Fixed script deployed"

# Kill existing workers
echo "[3/5] Stopping existing workers..."
tmux kill-session -t pzo-adam 2>/dev/null || echo "  (no active session)"
echo "✓ Workers stopped"

# Clear any corrupted queue entries
echo "[4/5] Validating queue integrity..."
QUEUE_FILE="docs/pzo1/runtime/task_queue/tasks.ndjson"
if [ -f "$QUEUE_FILE" ]; then
  # Backup queue
  cp "$QUEUE_FILE" "$QUEUE_FILE.pre-fix-$(date +%Y%m%d-%H%M%S)"
  
  # Filter out any malformed JSON lines
  VALID_TASKS=0
  INVALID_TASKS=0
  while IFS= read -r line; do
    if echo "$line" | jq empty 2>/dev/null; then
      echo "$line" >> "$QUEUE_FILE.tmp"
      ((VALID_TASKS++))
    else
      ((INVALID_TASKS++))
    fi
  done < "$QUEUE_FILE"
  
  if [ -f "$QUEUE_FILE.tmp" ]; then
    mv "$QUEUE_FILE.tmp" "$QUEUE_FILE"
    echo "✓ Queue validated: $VALID_TASKS valid, $INVALID_TASKS removed"
  else
    echo "✓ Queue empty or all tasks invalid"
    > "$QUEUE_FILE"
  fi
else
  echo "✗ Queue file not found"
fi

# Restart workers
echo "[5/5] Starting workers..."
tmux new-session -d -s pzo-adam -n worker-1 "cd $PROJECT_ROOT && bash scripts/worker/worker_loop.sh"
tmux new-window -t pzo-adam:1 -n worker-2 "cd $PROJECT_ROOT && bash scripts/worker/worker_loop.sh"
tmux new-window -t pzo-adam:2 -n worker-3 "cd $PROJECT_ROOT && bash scripts/worker/worker_loop.sh"
tmux new-window -t pzo-adam:3 -n worker-4 "cd $PROJECT_ROOT && bash scripts/worker/worker_loop.sh"
echo "✓ 4 workers started in tmux session 'pzo-adam'"

echo ""
echo "════════════════════════════════════════════════"
echo "FIX DEPLOYED SUCCESSFULLY"
echo "════════════════════════════════════════════════"
echo ""
echo "Workers are now processing remaining tasks."
echo "Monitor progress with:"
echo "  tmux attach -t pzo-adam"
echo ""
echo "Or check logs:"
echo "  tail -f docs/pzo1/runtime/logs/worker-*.log"
echo ""
