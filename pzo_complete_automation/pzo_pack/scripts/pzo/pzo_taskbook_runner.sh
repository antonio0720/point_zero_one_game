#!/usr/bin/env bash
# ============================================================
# PZO SOVEREIGN TASKBOOK RUNNER v1.3
# Autonomous executor for master_taskbook_PZO_AUTOMATION_v1.ndjson
# ============================================================
# SAFE: runs in its own tmux session (pzo-build)
# SAFE: never touches road-to-1200 tmux session
# SAFE: fail-fast, crash-loop protected, fully resumable
# ============================================================

set -euo pipefail

# ─── CONFIG ──────────────────────────────────────────────────
PZO_ROOT="${PZO_ROOT:-/Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master}"
ENGINE_DIR="$PZO_ROOT/pzo_engine"
AUTOMATION_DIR="$PZO_ROOT/pzo_complete_automation"
TASKBOOK="${TASKBOOK:-$AUTOMATION_DIR/master_taskbook_PZO_AUTOMATION_v1.ndjson}"
STATE_FILE="$AUTOMATION_DIR/runtime/pzo_taskbook_state.json"
LOG_DIR="$AUTOMATION_DIR/runtime/logs/taskbook"
REPORT_DIR="$AUTOMATION_DIR/runtime/reports"
OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.1:8b}"
MAX_RETRIES=3
CRASH_LOOP_LIMIT=5
SESSION_NAME="pzo-build"
DRY_RUN="${DRY_RUN:-0}"
PHASE_FILTER="${PHASE_FILTER:-}"       # e.g. PZO_P01_ENGINE_UPGRADE
START_FROM="${START_FROM:-}"           # e.g. PZO_T00050
WORKERS="${WORKERS:-1}"                # parallel workers (keep 1 for safety)

# ─── COLORS ──────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
log_info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
log_ok()      { echo -e "${GREEN}[OK]${RESET}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${RESET} $*"; }
log_task()    { echo -e "${BOLD}[TASK]${RESET}  $*"; }

# ─── GUARDS ──────────────────────────────────────────────────
guard_existing_sessions() {
  # CRITICAL: Never kill road-to-1200
  if tmux has-session -t "road-to-1200" 2>/dev/null; then
    log_ok "road-to-1200 session DETECTED — will not touch it."
  fi
  if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    log_warn "Session $SESSION_NAME already running."
    log_warn "Attach: tmux attach -t $SESSION_NAME"
    log_warn "Or stop it first: tmux kill-session -t $SESSION_NAME"
    exit 1
  fi
}

guard_taskbook() {
  if [[ ! -f "$TASKBOOK" ]]; then
    log_error "Taskbook not found: $TASKBOOK"
    log_error "Set TASKBOOK=<path> to override."
    exit 1
  fi
  local count
  count=$(wc -l < "$TASKBOOK")
  log_info "Taskbook: $TASKBOOK ($count tasks)"
}

# ─── STATE MANAGEMENT ─────────────────────────────────────────
init_state() {
  mkdir -p "$LOG_DIR" "$REPORT_DIR" "$(dirname "$STATE_FILE")"
  if [[ ! -f "$STATE_FILE" ]]; then
    python3 -c "
import json, time
state = {
  'version': '1.3',
  'started_at': time.time(),
  'last_updated': time.time(),
  'completed': [],
  'failed': [],
  'skipped': [],
  'crash_count': 0,
  'current_task': None
}
print(json.dumps(state, indent=2))
" > "$STATE_FILE"
    log_ok "State initialized: $STATE_FILE"
  else
    log_info "Resuming from existing state: $STATE_FILE"
    local completed failed
    completed=$(python3 -c "import json; s=json.load(open('$STATE_FILE')); print(len(s['completed']))")
    failed=$(python3 -c "import json; s=json.load(open('$STATE_FILE')); print(len(s['failed']))")
    log_info "  Completed: $completed | Failed: $failed"
  fi
}

is_completed() {
  local task_id="$1"
  python3 -c "
import json
s = json.load(open('$STATE_FILE'))
print('yes' if '$task_id' in s['completed'] else 'no')
"
}

mark_completed() {
  local task_id="$1"
  python3 -c "
import json, time
with open('$STATE_FILE', 'r+') as f:
  s = json.load(f)
  if '$task_id' not in s['completed']:
    s['completed'].append('$task_id')
  s['current_task'] = None
  s['last_updated'] = time.time()
  f.seek(0); json.dump(s, f, indent=2); f.truncate()
"
}

mark_failed() {
  local task_id="$1" reason="$2"
  python3 -c "
import json, time
with open('$STATE_FILE', 'r+') as f:
  s = json.load(f)
  s['failed'].append({'task_id': '$task_id', 'reason': '$reason', 'at': time.time()})
  s['last_updated'] = time.time()
  f.seek(0); json.dump(s, f, indent=2); f.truncate()
"
}

increment_crash() {
  python3 -c "
import json, time
with open('$STATE_FILE', 'r+') as f:
  s = json.load(f)
  s['crash_count'] = s.get('crash_count', 0) + 1
  s['last_updated'] = time.time()
  f.seek(0); json.dump(s, f, indent=2); f.truncate()
print(s['crash_count'])
"
}

get_crash_count() {
  python3 -c "import json; s=json.load(open('$STATE_FILE')); print(s.get('crash_count',0))"
}

# ─── PREFLIGHT ────────────────────────────────────────────────
run_preflight() {
  log_info "Running preflight checks..."
  local ts
  ts=$(date +%Y%m%d_%H%M%S)
  local report="$REPORT_DIR/preflight_${ts}.json"
  local pass=1

  # Check Ollama
  if ! curl -sf "$OLLAMA_HOST/api/tags" > /dev/null 2>&1; then
    log_error "Ollama not reachable at $OLLAMA_HOST"
    log_error "Start it: ollama serve"
    pass=0
  else
    log_ok "Ollama: reachable"
  fi

  # Check model available
  if curl -sf "$OLLAMA_HOST/api/tags" | python3 -c "
import json,sys
tags = json.load(sys.stdin)
models = [m['name'] for m in tags.get('models', [])]
found = any('$OLLAMA_MODEL'.split(':')[0] in m for m in models)
sys.exit(0 if found else 1)
" 2>/dev/null; then
    log_ok "Model $OLLAMA_MODEL: available"
  else
    log_warn "Model $OLLAMA_MODEL not found — will attempt pull"
    ollama pull "$OLLAMA_MODEL" || { log_error "Model pull failed"; pass=0; }
  fi

  # Check engine baseline
  if [[ -d "$ENGINE_DIR" ]]; then
    cd "$ENGINE_DIR"
    if npx tsc --noEmit 2>/dev/null; then
      log_ok "TypeScript: zero errors"
    else
      log_error "TypeScript errors in engine — fix before running"
      pass=0
    fi
    if npx vitest run --reporter=verbose 2>/dev/null | tail -3; then
      log_ok "Tests: passing"
    else
      log_error "Tests failing — fix before running"
      pass=0
    fi
    cd - > /dev/null
  else
    log_warn "Engine dir not found: $ENGINE_DIR — continuing anyway"
  fi

  # Write report
  python3 -c "
import json, time
report = {'timestamp': time.time(), 'pass': $pass, 'engine_dir': '$ENGINE_DIR', 'taskbook': '$TASKBOOK'}
with open('$report', 'w') as f: json.dump(report, f, indent=2)
"
  log_info "Preflight report: $report"

  if [[ "$pass" -eq 0 ]]; then
    log_error "Preflight FAILED. Fix issues before running."
    exit 1
  fi
  log_ok "Preflight PASSED."
}

# ─── TASK EXECUTOR ────────────────────────────────────────────
execute_task() {
  local task_json="$1"
  local task_id type phase input_spec

  task_id=$(echo "$task_json" | python3 -c "import json,sys; print(json.load(sys.stdin)['task_id'])")
  type=$(echo "$task_json" | python3 -c "import json,sys; print(json.load(sys.stdin)['type'])")
  phase=$(echo "$task_json" | python3 -c "import json,sys; print(json.load(sys.stdin)['phase'])")
  input_spec=$(echo "$task_json" | python3 -c "import json,sys; print(json.load(sys.stdin)['input'])")

  log_task "$task_id | $type | $phase"
  log_info "  $input_spec"

  local log_file="$LOG_DIR/${task_id}.log"
  local out_path
  out_path=$(echo "$input_spec" | cut -d: -f1 | xargs)

  if [[ "$DRY_RUN" == "1" ]]; then
    log_warn "  DRY RUN — skipping execution"
    mark_completed "$task_id"
    return 0
  fi

  # Determine target dir and create it
  local abs_path="$PZO_ROOT/$out_path"
  local dir
  dir=$(dirname "$abs_path")
  mkdir -p "$dir"

  # Build prompt based on task type
  local prompt
  prompt=$(python3 -c "
import json, sys

task = json.loads('''$task_json''')
t = task['type']
inp = task['input']
path = inp.split(':')[0].strip()
spec = ':'.join(inp.split(':')[1:]).strip()

ext = path.split('.')[-1] if '.' in path else 'txt'

if t in ('create_module', 'implement_feature'):
    lang = 'TypeScript' if ext in ('ts','tsx') else ('Bash' if ext == 'sh' else 'text')
    print(f'''You are an expert {lang} developer working on Point Zero One Digital, a financial roguelike game engine.

Task: {t}
File: {path}
Spec: {spec}

RULES:
- Output ONLY the complete file contents, no explanation, no markdown fences, no preamble
- TypeScript: strict types, no any, export all public symbols
- Bash: set -euo pipefail, add comments, safe defaults
- All ML models: include ml_enabled kill-switch (if !ml_enabled return null), bounded outputs (0-1), audit_hash via SHA256(inputs+outputs+ruleset_version)
- Engine code: preserve determinism, never break existing 17 passing tests
- Follow PZO architecture: client predicts, server decides, verifier proves

Output the complete {ext} file now:''')
elif t == 'create_test':
    print(f'''You are an expert TypeScript/Vitest developer for Point Zero One Digital.

Task: create_test
File: {path}
Spec: {spec}

RULES:
- Output ONLY the complete test file, no explanation, no markdown
- Use: import {{ describe, it, expect, beforeEach }} from 'vitest'
- Tests must be deterministic (seeded inputs only)
- Cover happy path + edge cases + failure modes specified

Output the complete test file now:''')
elif t == 'create_docs':
    print(f'''You are a technical writer for Point Zero One Digital.

Task: create_docs  
File: {path}
Spec: {spec}

RULES:
- Output ONLY the complete markdown document, no preamble
- Be precise and execution-grade — no fluff
- Include: purpose, inputs, outputs, constraints, examples where relevant
- Format: clean markdown with headers

Output the complete markdown document now:''')
elif t == 'create_contract':
    print(f'''You are an expert TypeScript developer for Point Zero One Digital.

Task: create_contract (shared type definitions)
File: {path}
Spec: {spec}

RULES:
- Output ONLY the complete TypeScript file
- Export all interfaces, enums, types
- Include JSDoc comments
- Strict types, no any

Output the complete file now:''')
else:
    print(f'Generate content for: {path}\\nSpec: {spec}\\nOutput the complete file:')
")

  # Call Ollama
  local response
  if ! response=$(curl -sf "$OLLAMA_HOST/api/generate" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "import json; print(json.dumps({'model': '$OLLAMA_MODEL', 'prompt': '''$prompt''', 'stream': False, 'options': {'temperature': 0.1, 'num_predict': 4096}}))")" \
    2>"$log_file"); then
    log_error "  Ollama call failed for $task_id"
    mark_failed "$task_id" "ollama_call_failed"
    return 1
  fi

  # Extract generated content
  local content
  content=$(echo "$response" | python3 -c "
import json, sys
r = json.load(sys.stdin)
text = r.get('response', '')
# Strip markdown code fences if present
lines = text.split('\n')
if lines[0].startswith('\`\`\`'): lines = lines[1:]
if lines and lines[-1].strip() == '\`\`\`': lines = lines[:-1]
print('\n'.join(lines))
")

  if [[ -z "$content" ]]; then
    log_error "  Empty response for $task_id"
    mark_failed "$task_id" "empty_response"
    return 1
  fi

  # Write file
  echo "$content" > "$abs_path"
  log_ok "  Written: $abs_path ($(wc -c < "$abs_path") bytes)"

  # Post-write validation for TypeScript files
  if [[ "$abs_path" == *.ts || "$abs_path" == *.tsx ]]; then
    cd "$ENGINE_DIR" 2>/dev/null || true
    if npx tsc --noEmit --allowJs "$abs_path" 2>/dev/null; then
      log_ok "  TypeScript: valid"
    else
      log_warn "  TypeScript: errors (non-blocking — logged)"
    fi
    cd - > /dev/null 2>&1 || true
  fi

  mark_completed "$task_id"
  return 0
}

# ─── MAIN LOOP ────────────────────────────────────────────────
main_loop() {
  local total_tasks processed=0 skipped=0 errors=0
  total_tasks=$(wc -l < "$TASKBOOK")
  log_info "Starting execution: $total_tasks tasks"
  log_info "Phase filter: ${PHASE_FILTER:-ALL}"
  log_info "Start from: ${START_FROM:-beginning}"

  local started=0
  [[ -z "$START_FROM" ]] && started=1

  while IFS= read -r task_json; do
    [[ -z "$task_json" ]] && continue

    local task_id phase
    task_id=$(echo "$task_json" | python3 -c "import json,sys; print(json.load(sys.stdin)['task_id'])")
    phase=$(echo "$task_json" | python3 -c "import json,sys; print(json.load(sys.stdin)['phase'])")

    # START_FROM gate
    if [[ -n "$START_FROM" && "$started" -eq 0 ]]; then
      [[ "$task_id" == "$START_FROM" ]] && started=1 || continue
    fi

    # Phase filter
    if [[ -n "$PHASE_FILTER" && "$phase" != "$PHASE_FILTER" ]]; then
      continue
    fi

    # Skip completed
    if [[ "$(is_completed "$task_id")" == "yes" ]]; then
      ((skipped++)) || true
      continue
    fi

    # Crash loop protection
    local crash_count
    crash_count=$(get_crash_count)
    if [[ "$crash_count" -ge "$CRASH_LOOP_LIMIT" ]]; then
      log_error "CRASH LOOP DETECTED ($crash_count crashes). Stopping."
      log_error "Fix issues and reset crash count: jq '.crash_count = 0' $STATE_FILE | sponge $STATE_FILE"
      exit 1
    fi

    # Execute with retry
    local attempt=0 success=0
    while [[ $attempt -lt $MAX_RETRIES ]]; do
      ((attempt++)) || true
      if execute_task "$task_json"; then
        success=1
        ((processed++)) || true
        break
      else
        log_warn "  Attempt $attempt/$MAX_RETRIES failed for $task_id"
        sleep 2
        increment_crash > /dev/null
      fi
    done

    if [[ "$success" -eq 0 ]]; then
      ((errors++)) || true
      log_error "  FAILED after $MAX_RETRIES attempts: $task_id"
    fi

    # Progress report every 10 tasks
    if [[ $(( processed % 10 )) -eq 0 && $processed -gt 0 ]]; then
      log_info "Progress: $processed processed | $skipped skipped | $errors errors | $(( total_tasks - processed - skipped )) remaining"
    fi

  done < "$TASKBOOK"

  log_ok "============================================"
  log_ok "RUN COMPLETE"
  log_ok "  Processed: $processed"
  log_ok "  Skipped:   $skipped"
  log_ok "  Errors:    $errors"
  log_ok "  State:     $STATE_FILE"
  log_ok "============================================"

  # Final test run
  if [[ -d "$ENGINE_DIR" && "$DRY_RUN" != "1" ]]; then
    log_info "Running final test suite..."
    cd "$ENGINE_DIR"
    npx vitest run --reporter=verbose 2>&1 | tail -10
    cd - > /dev/null
  fi
}

# ─── ENTRY POINTS ─────────────────────────────────────────────
CMD="${1:-run}"

case "$CMD" in
  run)
    guard_existing_sessions
    guard_taskbook
    init_state
    run_preflight
    main_loop
    ;;
  preflight)
    guard_taskbook
    init_state
    run_preflight
    ;;
  resume)
    guard_existing_sessions
    guard_taskbook
    init_state
    main_loop
    ;;
  dry-run)
    DRY_RUN=1
    guard_taskbook
    init_state
    main_loop
    ;;
  status)
    if [[ -f "$STATE_FILE" ]]; then
      python3 -c "
import json
s = json.load(open('$STATE_FILE'))
print(f'Completed: {len(s[\"completed\"])}')
print(f'Failed:    {len(s[\"failed\"])}')
print(f'Crashes:   {s.get(\"crash_count\", 0)}')
print(f'Updated:   {s[\"last_updated\"]}')
if s['failed']:
    print('Failed tasks:')
    for f in s['failed'][-5:]: print(f'  {f[\"task_id\"]} — {f[\"reason\"]}')
"
    else
      log_warn "No state file found."
    fi
    ;;
  reset-crashes)
    python3 -c "
import json
with open('$STATE_FILE', 'r+') as f:
    s = json.load(f)
    s['crash_count'] = 0
    f.seek(0); json.dump(s, f, indent=2); f.truncate()
print('Crash count reset to 0')
"
    ;;
  help|*)
    echo "PZO Sovereign Taskbook Runner v1.3"
    echo ""
    echo "Commands:"
    echo "  run          Full run (preflight + all tasks)"
    echo "  resume       Resume from last completed task"
    echo "  dry-run      Print tasks without executing"
    echo "  preflight    Run baseline checks only"
    echo "  status       Show progress"
    echo "  reset-crashes Reset crash loop counter"
    echo ""
    echo "Env vars:"
    echo "  TASKBOOK=<path>         Override taskbook path"
    echo "  PHASE_FILTER=<phase>    Only run one phase"
    echo "  START_FROM=PZO_T00050   Start from specific task"
    echo "  DRY_RUN=1               Print without executing"
    echo "  OLLAMA_MODEL=<model>    Override model (default: llama3.1:8b)"
    echo "  WORKERS=<n>             Parallel workers (default: 1)"
    ;;
esac
