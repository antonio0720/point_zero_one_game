#!/bin/bash
set -euo pipefail

echo "🚀 REBUILDING POINT ZERO ONE AUTOMATION FROM SCRATCH"
echo ""

# Navigate to project root
cd /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_complete_automation

# Create all directories
echo "📁 Creating directory structure..."
mkdir -p scripts/{_lib,bootstrap,bundles,git,notify,ops,queue,router,tmux,worker}
mkdir -p docs/pzo1/runtime/{task_queue,artifacts,logs,bundles,checkpoints,ledger}
mkdir -p shared/contracts/{ids,kernel,game}
mkdir -p backend frontend docs

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
cat > .env.local << 'ENV_EOF'
PZO_ROOT=/Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master
NOTIFY_PHONE=+18604360540
ENV_EOF
fi

# Create _lib/env.sh
cat > scripts/_lib/env.sh << 'ENVSH_EOF'
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/../../.env.local" ]; then
    source "$SCRIPT_DIR/../../.env.local"
fi

export PZO_ROOT="${PZO_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
export PZO_RUNTIME="$PZO_ROOT/pzo_complete_automation/docs/pzo1/runtime"
export PZO_QUEUE="$PZO_RUNTIME/task_queue"
export PZO_LOGS="$PZO_RUNTIME/logs"
export NOTIFY_PHONE="${NOTIFY_PHONE:-+18604360540}"

mkdir -p "$PZO_RUNTIME"/{ledger,task_queue,logs,artifacts,bundles,checkpoints}

export PZO_ENV_LOADED=true
ENVSH_EOF

# Create _lib/logging.sh
cat > scripts/_lib/logging.sh << 'LOGSH_EOF'
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
LOGSH_EOF

# Create ops/emergency_stop.sh
cat > scripts/ops/emergency_stop.sh << 'STOP_EOF'
#!/bin/bash
set -euo pipefail

echo "Stopping all automation..."

# Kill tmux session
tmux kill-session -t pzo-adam 2>/dev/null || true

# Kill any worker processes
pkill -f worker_loop.sh || true

echo "All stopped"
STOP_EOF

# Create ops/health_check.sh
cat > scripts/ops/health_check.sh << 'HEALTH_EOF'
#!/bin/bash
set -euo pipefail

source "$(dirname "$0")/../_lib/env.sh"

if tmux has-session -t pzo-adam 2>/dev/null; then
  echo "✓ tmux running"
else
  echo "✗ tmux not running"
  exit 1
fi

if pgrep -f worker_loop.sh > /dev/null; then
  echo "✓ worker running"
else
  echo "✗ worker not running"
  exit 1
fi

if [ -f "$PZO_QUEUE/tasks.ndjson" ]; then
  task_count=$(wc -l < "$PZO_QUEUE/tasks.ndjson")
  echo "✓ queue exists: $task_count tasks"
else
  echo "✗ queue missing"
  exit 1
fi

echo ""
echo "Current task: $(head -1 "$PZO_QUEUE/tasks.ndjson" 2>/dev/null | jq -r '.task_id' || echo 'none')"
echo "Last activity: $(tail -1 "$PZO_LOGS/worker.log" 2>/dev/null | cut -d' ' -f1-2 || echo 'no logs')"
HEALTH_EOF

# Create queue/seed_queue.sh
cat > scripts/queue/seed_queue.sh << 'SEED_EOF'
#!/bin/bash
set -euo pipefail

source "$(dirname "$0")/../_lib/env.sh"

if [ -f "$PZO_QUEUE/tasks.ndjson" ] && [ -s "$PZO_QUEUE/tasks.ndjson" ]; then
  task_count=$(wc -l < "$PZO_QUEUE/tasks.ndjson")
  echo "Queue already contains $task_count tasks - not overwriting"
  exit 0
fi

echo "WARNING: Queue is empty"
exit 1
SEED_EOF

# Create router/route_task.sh
cat > scripts/router/route_task.sh << 'ROUTE_EOF'
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
ROUTE_EOF

# Create worker/task_runner.sh
cat > scripts/worker/task_runner.sh << 'TASKRUN_EOF'
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
TASKRUN_EOF

# Create worker/worker_loop.sh
cat > scripts/worker/worker_loop.sh << 'WORKER_EOF'
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/../_lib/env.sh"
source "$SCRIPT_DIR/../_lib/logging.sh"

log_info "Worker started"

while true; do
  if [ ! -f "$PZO_QUEUE/tasks.ndjson" ] || [ ! -s "$PZO_QUEUE/tasks.ndjson" ]; then
    log_info "Queue empty, exiting"
    exit 0
  fi
  
  task_json=$(head -1 "$PZO_QUEUE/tasks.ndjson")
  task_id=$(echo "$task_json" | jq -r '.task_id')
  
  if "$SCRIPT_DIR/task_runner.sh" "$task_json"; then
    log_success "Completed: $task_id"
    
    tail -n +2 "$PZO_QUEUE/tasks.ndjson" > "$PZO_QUEUE/tasks.ndjson.tmp"
    mv "$PZO_QUEUE/tasks.ndjson.tmp" "$PZO_QUEUE/tasks.ndjson"
  else
    log_error "Failed: $task_id"
    
    retry_count=$(echo "$task_json" | jq -r '.retry_count // 0')
    new_retry=$((retry_count + 1))
    
    if [ $new_retry -ge 6 ]; then
      log_error "Max retries for $task_id, skipping"
      tail -n +2 "$PZO_QUEUE/tasks.ndjson" > "$PZO_QUEUE/tasks.ndjson.tmp"
      mv "$PZO_QUEUE/tasks.ndjson.tmp" "$PZO_QUEUE/tasks.ndjson"
    else
      updated_task=$(echo "$task_json" | jq ".retry_count = $new_retry")
      tail -n +2 "$PZO_QUEUE/tasks.ndjson" > "$PZO_QUEUE/tasks.ndjson.tmp"
      echo "$updated_task" >> "$PZO_QUEUE/tasks.ndjson.tmp"
      mv "$PZO_QUEUE/tasks.ndjson.tmp" "$PZO_QUEUE/tasks.ndjson"
    fi
  fi
  
  sleep 1
done
WORKER_EOF

# Create QUICK_START.sh
cat > QUICK_START.sh << 'QUICK_EOF'
#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

echo "═══════════════════════════════════════════════════════════"
echo "   POINT ZERO ONE - AUTONOMOUS BUILD SYSTEM"
echo "   Setting up Adam to build everything 24/7..."
echo "═══════════════════════════════════════════════════════════"

# Make scripts executable
chmod +x scripts/**/*.sh 2>/dev/null || true
chmod +x scripts/*/*.sh 2>/dev/null || true
find scripts -type f -name "*.sh" -exec chmod +x {} \;

# Source environment
source scripts/_lib/env.sh
source scripts/_lib/logging.sh

log_info "Bootstrapping Point Zero One..."

# Seed queue
scripts/queue/seed_queue.sh || true

# Start tmux
tmux kill-session -t pzo-adam 2>/dev/null || true
tmux new-session -d -s pzo-adam
tmux send-keys -t pzo-adam "cd $(pwd)" C-m
tmux send-keys -t pzo-adam "./scripts/worker/worker_loop.sh 2>&1 | tee -a $PZO_LOGS/worker.log" C-m

log_success "Bootstrap complete!"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "   ✅ ADAM IS NOW RUNNING 24/7"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Attach to tmux: tmux attach -t pzo-adam"
echo "  2. Watch logs: tail -f $PZO_LOGS/worker.log"
echo ""
echo "To detach from tmux: Press Ctrl+b, then d"
echo "To stop Adam: ./scripts/ops/emergency_stop.sh"
QUICK_EOF

# Make everything executable
chmod +x QUICK_START.sh
find scripts -type f -name "*.sh" -exec chmod +x {} \;

echo "✅ All scripts created and made executable"
echo ""
echo "📋 Next steps:"
echo "1. Copy master_taskbook_ALL_PHASES_P00-P59.ndjson to docs/pzo1/runtime/task_queue/tasks.ndjson"
echo "2. Run ./QUICK_START.sh"
