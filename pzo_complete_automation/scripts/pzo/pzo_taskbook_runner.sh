#!/usr/bin/env bash
# PZO SOVEREIGN TASKBOOK RUNNER v1.4 — FIXED OLLAMA JSON BUILD
set -euo pipefail

PZO_ROOT="${PZO_ROOT:-/Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master}"
ENGINE_DIR="$PZO_ROOT/pzo_engine"
AUTOMATION_DIR="$PZO_ROOT/pzo_complete_automation"
TASKBOOK="${TASKBOOK:-$AUTOMATION_DIR/master_taskbook_PZO_AUTOMATION_v1_3.ndjson}"
STATE_FILE="$AUTOMATION_DIR/runtime/pzo_taskbook_state.json"
LOG_DIR="$AUTOMATION_DIR/runtime/logs/taskbook"
REPORT_DIR="$AUTOMATION_DIR/runtime/reports"
OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.1:8b}"
MAX_RETRIES=3
CRASH_LOOP_LIMIT="${CRASH_LOOP_LIMIT:-50}"
SESSION_NAME="pzo-build"
DRY_RUN="${DRY_RUN:-0}"
PHASE_FILTER="${PHASE_FILTER:-}"
START_FROM="${START_FROM:-}"
TMPDIR_PZO="$AUTOMATION_DIR/runtime/tmp"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
log_info()  { echo -e "${CYAN}[INFO]${RESET}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${RESET}    $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
log_error() { echo -e "${RED}[ERROR]${RESET} $*"; }
log_task()  { echo -e "${BOLD}[TASK]${RESET}  $*"; }

# ── TMUX GUARD ───────────────────────────────────────────────
guard_existing_sessions() {
  [[ -n "${TMUX:-}" ]] && return 0
  if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    log_warn "Session $SESSION_NAME already running."
    log_warn "Attach: tmux attach -t $SESSION_NAME"
    log_warn "Or stop: tmux kill-session -t $SESSION_NAME"
    exit 1
  fi
}

guard_taskbook() {
  if [[ ! -f "$TASKBOOK" ]]; then
    log_error "Taskbook not found: $TASKBOOK"
    exit 1
  fi
  local count; count=$(wc -l < "$TASKBOOK")
  log_info "Taskbook: $TASKBOOK ($count tasks)"
}

# ── STATE ────────────────────────────────────────────────────
init_state() {
  mkdir -p "$LOG_DIR" "$REPORT_DIR" "$TMPDIR_PZO" "$(dirname "$STATE_FILE")"
  if [[ ! -f "$STATE_FILE" ]]; then
    python3 -c "
import json, time
print(json.dumps({'version':'1.4','started_at':time.time(),'last_updated':time.time(),
  'completed':[],'failed':[],'skipped':[],'crash_count':0,'current_task':None}, indent=2))
" > "$STATE_FILE"
    log_ok "State initialized: $STATE_FILE"
  else
    log_info "Resuming from state: $STATE_FILE"
    local c f
    c=$(python3 -c "import json; s=json.load(open('$STATE_FILE')); print(len(s['completed']))")
    f=$(python3 -c "import json; s=json.load(open('$STATE_FILE')); print(len(s['failed']))")
    log_info "  Completed: $c | Failed: $f"
  fi
}

is_completed() {
  python3 -c "
import json
s=json.load(open('$STATE_FILE'))
print('yes' if '$1' in s['completed'] else 'no')
"
}

mark_completed() {
  python3 -c "
import json,time
with open('$STATE_FILE','r+') as f:
  s=json.load(f)
  if '$1' not in s['completed']: s['completed'].append('$1')
  s['current_task']=None; s['last_updated']=time.time()
  f.seek(0); json.dump(s,f,indent=2); f.truncate()
"
}

mark_failed() {
  python3 -c "
import json,time
with open('$STATE_FILE','r+') as f:
  s=json.load(f)
  s['failed'].append({'task_id':'$1','reason':'$2','at':time.time()})
  s['last_updated']=time.time()
  f.seek(0); json.dump(s,f,indent=2); f.truncate()
"
}

get_crash_count() {
  python3 -c "import json; s=json.load(open('$STATE_FILE')); print(s.get('crash_count',0))"
}

increment_crash() {
  python3 -c "
import json,time
with open('$STATE_FILE','r+') as f:
  s=json.load(f)
  s['crash_count']=s.get('crash_count',0)+1
  s['last_updated']=time.time()
  f.seek(0); json.dump(s,f,indent=2); f.truncate()
print(s['crash_count'])
"
}

# ── PREFLIGHT ────────────────────────────────────────────────
run_preflight() {
  log_info "Running preflight checks..."
  local pass=1

  if ! curl -sf "$OLLAMA_HOST/api/tags" > /dev/null 2>&1; then
    log_error "Ollama not reachable"; pass=0
  else
    log_ok "Ollama: reachable"
    # Check model
    if curl -sf "$OLLAMA_HOST/api/tags" | python3 -c "
import json,sys
tags=json.load(sys.stdin)
models=[m['name'] for m in tags.get('models',[])]
found=any('$OLLAMA_MODEL'.split(':')[0] in m for m in models)
exit(0 if found else 1)
" 2>/dev/null; then
      log_ok "Model $OLLAMA_MODEL: available"
    else
      log_warn "Pulling $OLLAMA_MODEL..."
      ollama pull "$OLLAMA_MODEL" || { log_error "Model pull failed"; pass=0; }
    fi
  fi

  if [[ -d "$ENGINE_DIR" ]]; then
    cd "$ENGINE_DIR"
    if npx tsc --noEmit 2>/dev/null; then log_ok "TypeScript: zero errors"
    else log_error "TypeScript errors"; pass=0; fi
    if npx vitest run --reporter=verbose 2>/dev/null | tail -3; then log_ok "Tests: passing"
    else log_error "Tests failing"; pass=0; fi
    cd - > /dev/null
  fi

  local ts; ts=$(date +%Y%m%d_%H%M%S)
  python3 -c "
import json,time
with open('$REPORT_DIR/preflight_${ts}.json','w') as f:
  json.dump({'timestamp':time.time(),'pass':$pass,'taskbook':'$TASKBOOK'},f,indent=2)
"
  log_info "Preflight report: $REPORT_DIR/preflight_${ts}.json"
  if [[ "$pass" -eq 0 ]]; then log_error "Preflight FAILED."; exit 1; fi
  log_ok "Preflight PASSED."
}

# ── CORE: BUILD OLLAMA PAYLOAD VIA TEMP PYTHON SCRIPT ────────
# This avoids ALL quoting/escaping issues with inline -c
call_ollama() {
  local task_id="$1" task_type="$2" task_phase="$3" input_spec="$4"
  local out_path; out_path=$(echo "$input_spec" | cut -d: -f1 | xargs)
  local spec; spec=$(echo "$input_spec" | cut -d: -f2- | xargs)
  local ext="${out_path##*.}"

  # Write a real Python script to a temp file — no escaping nightmares
  local py_script="$TMPDIR_PZO/ollama_call_$$.py"

  cat > "$py_script" << PYEOF
import json, urllib.request, sys, os

host = os.environ.get('OLLAMA_HOST', 'http://localhost:11434')
model = os.environ.get('OLLAMA_MODEL', 'llama3.1:8b')

task_type = """$task_type"""
out_path = """$out_path"""
spec = """$spec"""
ext = """$ext"""

lang_map = {'ts': 'TypeScript', 'tsx': 'TypeScript React', 'sh': 'Bash', 'md': 'Markdown', 'py': 'Python'}
lang = lang_map.get(ext, 'text')

if task_type in ('create_module', 'implement_feature'):
    prompt = f"""You are an expert {lang} developer for Point Zero One Digital, a financial roguelike game engine.

File: {out_path}
Spec: {spec}

Rules:
- Output ONLY the complete file contents. No explanation. No markdown fences. No preamble.
- TypeScript: strict types, no any, export all public symbols
- Bash: set -euo pipefail, safe defaults
- ML models: include ml_enabled kill-switch, bounded outputs 0-1, audit_hash
- Engine: preserve determinism

Output the complete {ext} file now:"""

elif task_type == 'create_test':
    prompt = f"""You are an expert TypeScript/Vitest developer for Point Zero One Digital.

File: {out_path}
Spec: {spec}

Rules:
- Output ONLY the complete test file. No explanation. No markdown fences.
- Use: import {{ describe, it, expect }} from 'vitest'
- Tests must be deterministic

Output the complete test file now:"""

elif task_type == 'create_docs':
    prompt = f"""You are a technical writer for Point Zero One Digital.

File: {out_path}
Spec: {spec}

Rules:
- Output ONLY the complete markdown document. No preamble.
- Precise, execution-grade. No fluff.

Output the complete markdown document now:"""

elif task_type == 'create_contract':
    prompt = f"""You are an expert TypeScript developer for Point Zero One Digital.

File: {out_path}
Spec: {spec}

Rules:
- Output ONLY the complete TypeScript file
- Export all interfaces, enums, types
- Include JSDoc comments

Output the complete file now:"""

else:
    prompt = f"Generate content for: {out_path}\nSpec: {spec}\nOutput the complete file:"

payload = json.dumps({
    'model': model,
    'prompt': prompt,
    'stream': False,
    'options': {'temperature': 0.1, 'num_predict': 4096}
}).encode('utf-8')

req = urllib.request.Request(
    f'{host}/api/generate',
    data=payload,
    headers={'Content-Type': 'application/json'},
    method='POST'
)

try:
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.loads(resp.read())
        text = data.get('response', '')
        lines = text.split('\n')
        if lines and lines[0].startswith('\`\`\`'):
            lines = lines[1:]
        if lines and lines[-1].strip() == '\`\`\`':
            lines = lines[:-1]
        print('\n'.join(lines))
        sys.exit(0)
except Exception as e:
    sys.stderr.write(f'OLLAMA_ERROR: {e}\n')
    sys.exit(1)
PYEOF

  python3 "$py_script"
  local exit_code=$?
  rm -f "$py_script"
  return $exit_code
}

# ── EXECUTE ONE TASK ─────────────────────────────────────────
execute_task() {
  local task_json="$1"
  local task_id type phase input_spec

  task_id=$(echo "$task_json" | python3 -c "import json,sys; print(json.load(sys.stdin)['task_id'])")
  type=$(echo "$task_json"    | python3 -c "import json,sys; print(json.load(sys.stdin)['type'])")
  phase=$(echo "$task_json"   | python3 -c "import json,sys; print(json.load(sys.stdin)['phase'])")
  input_spec=$(echo "$task_json" | python3 -c "import json,sys; print(json.load(sys.stdin)['input'])")

  log_task "$task_id | $type | $phase"
  log_info "  $input_spec"

  if [[ "$DRY_RUN" == "1" ]]; then
    log_warn "  DRY RUN — skipping"
    mark_completed "$task_id"
    return 0
  fi

  local out_path; out_path=$(echo "$input_spec" | cut -d: -f1 | xargs)
  local abs_path="$PZO_ROOT/$out_path"
  mkdir -p "$(dirname "$abs_path")"

  # Jitter to avoid hammering Ollama when revops is also running
  local jitter=$(( RANDOM % 6 + 2 ))
  log_info "  Waiting ${jitter}s (Ollama jitter)..."
  sleep "$jitter"

  local content
  if content=$(call_ollama "$task_id" "$type" "$phase" "$input_spec" 2>/tmp/pzo_ollama_err_$$); then
    if [[ -z "$content" ]]; then
      log_error "  Empty response for $task_id"
      rm -f /tmp/pzo_ollama_err_$$
      mark_failed "$task_id" "empty_response"
      return 1
    fi
    echo "$content" > "$abs_path"
    local sz; sz=$(wc -c < "$abs_path")
    log_ok "  Written: $abs_path ($sz bytes)"
    rm -f /tmp/pzo_ollama_err_$$
    mark_completed "$task_id"
    return 0
  else
    local err; err=$(cat /tmp/pzo_ollama_err_$$ 2>/dev/null || echo "unknown")
    log_error "  Ollama call failed for $task_id: $err"
    rm -f /tmp/pzo_ollama_err_$$
    mark_failed "$task_id" "ollama_call_failed"
    return 1
  fi
}

# ── MAIN LOOP ────────────────────────────────────────────────
main_loop() {
  local total_tasks processed=0 skipped=0 errors=0
  total_tasks=$(wc -l < "$TASKBOOK")
  log_info "Starting execution: $total_tasks tasks"
  log_info "Phase filter: ${PHASE_FILTER:-ALL}"
  log_info "Start from: ${START_FROM:-beginning}"
  log_info "Crash loop limit: $CRASH_LOOP_LIMIT"

  local started=0
  [[ -z "$START_FROM" ]] && started=1

  while IFS= read -r task_json; do
    [[ -z "$task_json" ]] && continue

    local task_id phase
    task_id=$(echo "$task_json" | python3 -c "import json,sys; print(json.load(sys.stdin)['task_id'])")
    phase=$(echo "$task_json"   | python3 -c "import json,sys; print(json.load(sys.stdin)['phase'])")

    if [[ -n "$START_FROM" && "$started" -eq 0 ]]; then
      [[ "$task_id" == "$START_FROM" ]] && started=1 || continue
    fi

    if [[ -n "$PHASE_FILTER" && "$phase" != "$PHASE_FILTER" ]]; then
      continue
    fi

    if [[ "$(is_completed "$task_id")" == "yes" ]]; then
      ((skipped++)) || true
      continue
    fi

    local crash_count; crash_count=$(get_crash_count)
    if [[ "$crash_count" -ge "$CRASH_LOOP_LIMIT" ]]; then
      log_error "CRASH LOOP DETECTED ($crash_count). Stopping."
      exit 1
    fi

    local attempt=0 success=0
    while [[ $attempt -lt $MAX_RETRIES ]]; do
      ((attempt++)) || true
      if execute_task "$task_json"; then
        success=1
        ((processed++)) || true
        break
      else
        log_warn "  Attempt $attempt/$MAX_RETRIES failed — waiting 15s before retry..."
        sleep 15
        increment_crash > /dev/null
      fi
    done

    if [[ "$success" -eq 0 ]]; then
      ((errors++)) || true
      log_error "  PERMANENTLY FAILED: $task_id"
    fi

    if [[ $(( (processed + errors) % 10 )) -eq 0 && $(( processed + errors )) -gt 0 ]]; then
      log_info "=== Progress: $processed done | $skipped skipped | $errors errors | $(( total_tasks - processed - skipped - errors )) remaining ==="
    fi

  done < "$TASKBOOK"

  log_ok "RUN COMPLETE — Processed: $processed | Skipped: $skipped | Errors: $errors"

  if [[ -d "$ENGINE_DIR" && "$DRY_RUN" != "1" ]]; then
    log_info "Final test run..."
    cd "$ENGINE_DIR" && npx vitest run --reporter=verbose 2>&1 | tail -5; cd - > /dev/null
  fi
}

# ── ENTRY ────────────────────────────────────────────────────
CMD="${1:-run}"
case "$CMD" in
  run)
    guard_existing_sessions
    guard_taskbook
    init_state
    run_preflight
    main_loop
    ;;
  resume)
    guard_existing_sessions
    guard_taskbook
    init_state
    main_loop
    ;;
  preflight)
    guard_taskbook
    init_state
    run_preflight
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
s=json.load(open('$STATE_FILE'))
print(f'Completed: {len(s[\"completed\"])}')
print(f'Failed:    {len(s[\"failed\"])}')
print(f'Crashes:   {s.get(\"crash_count\",0)}')
if s['failed']:
    print('Last failed:')
    for f in s['failed'][-3:]: print(f'  {f[\"task_id\"]} — {f[\"reason\"]}')
"
    fi
    ;;
  reset-crashes)
    python3 -c "
import json
with open('$STATE_FILE','r+') as f:
  s=json.load(f); s['crash_count']=0; s['failed']=[]
  f.seek(0); json.dump(s,f,indent=2); f.truncate()
print('Reset done')
"
    ;;
esac
