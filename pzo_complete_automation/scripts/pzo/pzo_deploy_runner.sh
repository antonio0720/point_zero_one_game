#!/usr/bin/env bash
# ============================================================
# PZO SOVEREIGN DEPLOYMENT RUNNER v1.0
# Taskbook: master_taskbook_PZO_DEPLOYMENT_HOW_TO_DEPLOY_v1_0.ndjson
# Session:  pzo-deploy  (never touches pzo-build or road-to-1200)
# ============================================================
set -euo pipefail

PZO_ROOT="${PZO_ROOT:-/Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master}"
AUTOMATION_DIR="$PZO_ROOT/pzo_complete_automation"
TASKBOOK="${TASKBOOK:-$AUTOMATION_DIR/master_taskbook_PZO_DEPLOYMENT_HOW_TO_DEPLOY_v1_0.ndjson}"
STATE_FILE="$AUTOMATION_DIR/runtime/pzo_deploy_state.json"
LOG_DIR="$AUTOMATION_DIR/runtime/logs/deploy"
REPORT_DIR="$AUTOMATION_DIR/runtime/reports"
TMPDIR_PZO="$AUTOMATION_DIR/runtime/tmp"
OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.1:8b}"
MAX_RETRIES=3
CRASH_LOOP_LIMIT="${CRASH_LOOP_LIMIT:-50}"
SESSION_NAME="pzo-deploy"
DRY_RUN="${DRY_RUN:-0}"
PHASE_FILTER="${PHASE_FILTER:-}"
START_FROM="${START_FROM:-}"
CONCURRENCY="${CONCURRENCY:-1}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'; MAGENTA='\033[0;35m'

log_info()  { echo -e "${CYAN}[$(date -u +%H:%M:%S)][INFO]${RESET}  $*" | tee -a "$LOG_DIR/runner_$(date +%Y%m%d).log"; }
log_ok()    { echo -e "${GREEN}[$(date -u +%H:%M:%S)][OK]${RESET}    $*" | tee -a "$LOG_DIR/runner_$(date +%Y%m%d).log"; }
log_warn()  { echo -e "${YELLOW}[$(date -u +%H:%M:%S)][WARN]${RESET}  $*" | tee -a "$LOG_DIR/runner_$(date +%Y%m%d).log"; }
log_error() { echo -e "${RED}[$(date -u +%H:%M:%S)][ERROR]${RESET} $*" | tee -a "$LOG_DIR/runner_$(date +%Y%m%d).log"; }
log_task()  { echo -e "${BOLD}${MAGENTA}[$(date -u +%H:%M:%S)][TASK]${RESET}  $*" | tee -a "$LOG_DIR/runner_$(date +%Y%m%d).log"; }

# ── GUARDS ───────────────────────────────────────────────────
guard_sessions() {
  [[ -n "${TMUX:-}" ]] && return 0
  # Never kill road-to-1200 or pzo-build
  for safe in "road-to-1200" "pzo-build"; do
    if tmux has-session -t "$safe" 2>/dev/null; then
      log_info "✅ $safe is alive — not touching it."
    fi
  done
  if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    log_warn "Session $SESSION_NAME already running."
    log_warn "  Attach: tmux attach -t $SESSION_NAME"
    log_warn "  Stop:   bash $(dirname "$0")/pzo_deploy_stop.sh"
    exit 1
  fi
}

guard_taskbook() {
  if [[ ! -f "$TASKBOOK" ]]; then
    log_error "Taskbook not found: $TASKBOOK"
    log_error "Expected: $TASKBOOK"
    exit 1
  fi
  local count; count=$(wc -l < "$TASKBOOK")
  log_ok "Taskbook: $TASKBOOK ($count tasks)"
}

# ── STATE ────────────────────────────────────────────────────
init_state() {
  mkdir -p "$LOG_DIR" "$REPORT_DIR" "$TMPDIR_PZO" "$(dirname "$STATE_FILE")"
  if [[ ! -f "$STATE_FILE" ]]; then
    python3 - << 'PYEOF'
import json, time, os
state_file = os.environ.get('STATE_FILE', '')
data = {
    'version': '1.0',
    'taskbook': 'master_taskbook_PZO_DEPLOYMENT_HOW_TO_DEPLOY_v1_0.ndjson',
    'started_at': time.time(),
    'last_updated': time.time(),
    'completed': [],
    'failed': [],
    'skipped': [],
    'crash_count': 0,
    'current_task': None,
    'session': 'pzo-deploy'
}
print(json.dumps(data, indent=2))
PYEOF
    python3 -c "
import json, time
data = {
    'version': '1.0',
    'taskbook': 'master_taskbook_PZO_DEPLOYMENT_HOW_TO_DEPLOY_v1_0.ndjson',
    'started_at': time.time(),
    'last_updated': time.time(),
    'completed': [],
    'failed': [],
    'skipped': [],
    'crash_count': 0,
    'current_task': None,
    'session': 'pzo-deploy'
}
with open('$STATE_FILE', 'w') as f:
    json.dump(data, f, indent=2)
print('State initialized.')
"
    log_ok "State initialized: $STATE_FILE"
  else
    log_info "Resuming from state: $STATE_FILE"
    python3 -c "
import json
s = json.load(open('$STATE_FILE'))
c = len(s['completed'])
f = len(s['failed'])
total = 1325
pct = int(c * 100 / total)
print(f'  Completed: {c} ({pct}%) | Failed: {f} | Crashes: {s.get(\"crash_count\",0)}')
"
  fi
}

is_completed() {
  python3 -c "
import json
s = json.load(open('$STATE_FILE'))
print('yes' if '$1' in s['completed'] else 'no')
"
}

mark_current() {
  python3 -c "
import json, time
with open('$STATE_FILE', 'r+') as f:
    s = json.load(f)
    s['current_task'] = '$1'
    s['last_updated'] = time.time()
    f.seek(0); json.dump(s, f, indent=2); f.truncate()
" 2>/dev/null || true
}

mark_completed() {
  python3 -c "
import json, time
with open('$STATE_FILE', 'r+') as f:
    s = json.load(f)
    if '$1' not in s['completed']:
        s['completed'].append('$1')
    s['current_task'] = None
    s['last_updated'] = time.time()
    f.seek(0); json.dump(s, f, indent=2); f.truncate()
"
}

mark_failed() {
  python3 -c "
import json, time
with open('$STATE_FILE', 'r+') as f:
    s = json.load(f)
    s['failed'].append({'task_id': '$1', 'reason': '$2', 'at': time.time()})
    s['last_updated'] = time.time()
    f.seek(0); json.dump(s, f, indent=2); f.truncate()
"
}

get_crash_count() {
  python3 -c "import json; s=json.load(open('$STATE_FILE')); print(s.get('crash_count',0))"
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

# ── PREFLIGHT ────────────────────────────────────────────────
run_preflight() {
  log_info "════ PREFLIGHT ════════════════════════════════════════"
  local pass=1

  # Ollama check
  if curl -sf "$OLLAMA_HOST/api/tags" > /dev/null 2>&1; then
    log_ok "Ollama: reachable at $OLLAMA_HOST"
    if curl -sf "$OLLAMA_HOST/api/tags" | python3 -c "
import json, sys
tags = json.load(sys.stdin)
models = [m['name'] for m in tags.get('models', [])]
found = any('$OLLAMA_MODEL'.split(':')[0] in m for m in models)
sys.exit(0 if found else 1)
" 2>/dev/null; then
      log_ok "Model $OLLAMA_MODEL: available"
    else
      log_warn "Pulling $OLLAMA_MODEL..."
      ollama pull "$OLLAMA_MODEL" || { log_error "Model pull failed"; pass=0; }
    fi
  else
    log_error "Ollama not reachable at $OLLAMA_HOST"
    log_error "  Run: ollama serve"
    pass=0
  fi

  # Taskbook integrity
  local total; total=$(wc -l < "$TASKBOOK")
  local valid; valid=$(python3 -c "
import json
count = 0
with open('$TASKBOOK') as f:
    for line in f:
        line = line.strip()
        if line:
            try:
                t = json.loads(line)
                if 'task_id' in t and 'type' in t and 'input' in t:
                    count += 1
            except: pass
print(count)
")
  log_ok "Taskbook integrity: $valid/$total valid tasks"

  # Check existing sessions (just inform)
  for sess in "road-to-1200" "pzo-build"; do
    if tmux has-session -t "$sess" 2>/dev/null; then
      log_ok "$sess: running (untouched)"
    fi
  done

  # Jitter config for coexistence with other Ollama consumers
  log_info "Ollama jitter: 2-8s per task (avoids contention with other runners)"

  local ts; ts=$(date +%Y%m%d_%H%M%S)
  python3 -c "
import json, time
with open('$REPORT_DIR/deploy_preflight_${ts}.json', 'w') as f:
    json.dump({'timestamp': time.time(), 'pass': $pass, 'taskbook': '$TASKBOOK', 'ollama_model': '$OLLAMA_MODEL'}, f, indent=2)
"
  log_info "Preflight report: $REPORT_DIR/deploy_preflight_${ts}.json"

  if [[ "$pass" -eq 0 ]]; then
    log_error "Preflight FAILED. Fix issues above then retry."
    exit 1
  fi
  log_ok "════ PREFLIGHT PASSED ══════════════════════════════════"
}

# ── OLLAMA CALL (Python temp script to avoid quoting hell) ────
call_ollama() {
  local task_id="$1" task_type="$2" task_phase="$3" input_spec="$4"
  local out_path; out_path=$(echo "$input_spec" | python3 -c "import sys; line=sys.stdin.read().strip(); print(line.split(':')[0].strip())")
  local spec; spec=$(echo "$input_spec" | python3 -c "import sys; line=sys.stdin.read().strip(); parts=line.split(':',1); print(parts[1].strip() if len(parts)>1 else line)")
  local ext="${out_path##*.}"

  local py_script="$TMPDIR_PZO/deploy_call_$$.py"

  cat > "$py_script" << PYEOF
import json, urllib.request, sys, os

host  = os.environ.get('OLLAMA_HOST',  'http://localhost:11434')
model = os.environ.get('OLLAMA_MODEL', 'llama3.1:8b')

task_type = """${task_type}"""
out_path  = """${out_path}"""
spec      = """${spec}"""
ext       = """${ext}"""

lang_map = {
    'ts':  'TypeScript', 'tsx': 'TypeScript React', 'sh':  'Bash',
    'md':  'Markdown',   'py':  'Python',           'sql': 'SQL',
    'yaml':'YAML',       'yml': 'YAML',             'json':'JSON',
    'proto':'Protobuf',  'js':  'JavaScript',       'tf':  'Terraform HCL',
}
lang = lang_map.get(ext, 'text')

GAME_CONTEXT = """
Point Zero One Digital: a 12-minute financial roguelike game.
Sovereign infrastructure architect design. Production-grade, deployment-ready.
Never use 'any' in TypeScript. All code is strict-mode. All effects are deterministic.
"""

if task_type in ('create_module', 'implement_feature', 'create_contract', 'create_migration', 'create_job'):
    prompt = f"""You are a senior {lang} engineer for Point Zero One Digital.
{GAME_CONTEXT}
File: {out_path}
Spec: {spec}

Rules:
- Output ONLY the complete file contents. No markdown fences. No explanations. No preamble.
- TypeScript: strict types, no 'any', export all public symbols, include JSDoc
- SQL: include indexes, foreign keys, comments; idempotent (CREATE IF NOT EXISTS)
- Bash: set -euo pipefail, log all actions
- YAML/JSON/Terraform: production-ready with all required fields
- Preserve determinism where the spec involves game engine or replay

Output the complete {ext} file now:"""

elif task_type in ('create_tests', 'create_test'):
    prompt = f"""You are a senior test engineer for Point Zero One Digital.
{GAME_CONTEXT}
File: {out_path}
Spec: {spec}

Rules:
- Output ONLY the complete test file. No markdown fences. No preamble.
- TypeScript tests: import {{ describe, it, expect, beforeEach, afterEach }} from 'vitest'
- All tests must be deterministic (no random seeds unless seeded)
- Cover happy path, edge cases, and boundary conditions

Output the complete test file now:"""

elif task_type == 'create_docs':
    prompt = f"""You are a technical writer for Point Zero One Digital.
{GAME_CONTEXT}
File: {out_path}
Spec: {spec}

Rules:
- Output ONLY the complete markdown document. No preamble.
- Use precise, execution-grade language. Zero fluff. Anti-bureaucratic.
- Include: overview, non-negotiables, implementation spec, edge cases where relevant.

Output the complete markdown document now:"""

elif task_type == 'create_ops':
    prompt = f"""You are a senior DevOps/SRE engineer for Point Zero One Digital.
{GAME_CONTEXT}
File: {out_path}
Spec: {spec}

Rules:
- Output ONLY the complete file contents. No markdown fences. No preamble.
- YAML: valid schema, all required fields, comments on non-obvious config
- Shell: idempotent, has rollback notes, logs to structured output
- Grafana JSON: complete valid dashboard JSON

Output the complete {ext} file now:"""

else:
    prompt = f"Generate complete file for Point Zero One Digital.\\nFile: {out_path}\\nSpec: {spec}\\nOutput the complete file:"

payload = json.dumps({
    'model': model,
    'prompt': prompt,
    'stream': False,
    'options': {'temperature': 0.05, 'num_predict': 4096, 'top_p': 0.9}
}).encode('utf-8')

req = urllib.request.Request(
    f'{host}/api/generate',
    data=payload,
    headers={'Content-Type': 'application/json'},
    method='POST'
)

try:
    with urllib.request.urlopen(req, timeout=240) as resp:
        data = json.loads(resp.read())
        text = data.get('response', '').strip()
        # Strip markdown fences
        lines = text.split('\\n')
        if lines and lines[0].strip().startswith('\`\`\`'):
            lines = lines[1:]
        if lines and lines[-1].strip() == '\`\`\`':
            lines = lines[:-1]
        output = '\\n'.join(lines).strip()
        if not output:
            sys.stderr.write('EMPTY_RESPONSE\\n')
            sys.exit(2)
        print(output)
        sys.exit(0)
except urllib.error.HTTPError as e:
    sys.stderr.write(f'HTTP_ERROR: {e.code} {e.reason}\\n')
    sys.exit(1)
except Exception as e:
    sys.stderr.write(f'OLLAMA_ERROR: {e}\\n')
    sys.exit(1)
PYEOF

  python3 "$py_script"
  local ec=$?
  rm -f "$py_script"
  return $ec
}

# ── ROUTE MODEL BY RETRY + TASK TYPE ─────────────────────────
route_model() {
  local task_type="$1" retry="$2"
  case $retry in
    0) echo "mistral:7b" ;;
    1) echo "llama3.1:8b" ;;
    2) echo "qwen2.5:7b" ;;
    3) echo "llama3.1:8b" ;;
    4) echo "qwen2.5:14b" ;;
    5) echo "qwen2.5:32b" ;;
    *) echo "mistral:7b" ;;
  esac
}

# ── EXECUTE ONE TASK ─────────────────────────────────────────
execute_task() {
  local task_json="$1"

  local task_id type phase input_spec retry_count
  task_id=$(echo "$task_json"    | python3 -c "import json,sys; print(json.load(sys.stdin)['task_id'])")
  type=$(echo "$task_json"       | python3 -c "import json,sys; print(json.load(sys.stdin)['type'])")
  phase=$(echo "$task_json"      | python3 -c "import json,sys; print(json.load(sys.stdin)['phase'])")
  input_spec=$(echo "$task_json" | python3 -c "import json,sys; print(json.load(sys.stdin)['input'])")
  retry_count=$(echo "$task_json"| python3 -c "import json,sys; print(json.load(sys.stdin).get('retry_count',0))")

  local model; model=$(route_model "$type" "$retry_count")
  export OLLAMA_MODEL="$model"

  log_task "$task_id | $type | $phase"
  log_info "  Model: $model | Input: ${input_spec:0:80}..."

  mark_current "$task_id"

  if [[ "$DRY_RUN" == "1" ]]; then
    log_warn "  DRY RUN — skipping execution"
    mark_completed "$task_id"
    return 0
  fi

  # Extract output path and resolve to absolute
  local out_path; out_path=$(echo "$input_spec" | python3 -c "
import sys
line = sys.stdin.read().strip()
path = line.split(':')[0].strip()
print(path)
")

  local abs_path="$PZO_ROOT/$out_path"
  mkdir -p "$(dirname "$abs_path")"

  # Jitter: 2-8s to avoid hammering Ollama when other runners are alive
  local jitter=$(( RANDOM % 7 + 2 ))
  log_info "  Jitter: ${jitter}s..."
  sleep "$jitter"

  local err_file="/tmp/pzo_deploy_err_$$"
  local content

  if content=$(call_ollama "$task_id" "$type" "$phase" "$input_spec" 2>"$err_file"); then
    if [[ -z "$content" ]]; then
      log_error "  Empty response for $task_id"
      rm -f "$err_file"
      mark_failed "$task_id" "empty_response"
      return 1
    fi

    echo "$content" > "$abs_path"
    local sz; sz=$(wc -c < "$abs_path" 2>/dev/null || echo 0)

    if [[ "$sz" -lt 10 ]]; then
      log_error "  File too small ($sz bytes): $abs_path"
      rm -f "$abs_path" "$err_file"
      mark_failed "$task_id" "file_too_small"
      return 1
    fi

    # Also save artifact
    cp "$abs_path" "$AUTOMATION_DIR/runtime/artifacts/${task_id}.txt" 2>/dev/null || true

    log_ok "  Written: $abs_path ($sz bytes)"
    rm -f "$err_file"
    mark_completed "$task_id"
    return 0
  else
    local err; err=$(cat "$err_file" 2>/dev/null | head -3 || echo "unknown")
    log_error "  Ollama failed for $task_id: $err"
    rm -f "$err_file"
    mark_failed "$task_id" "ollama_error"
    return 1
  fi
}

# ── MAIN LOOP ────────────────────────────────────────────────
main_loop() {
  local total_tasks processed=0 skipped=0 errors=0
  total_tasks=$(wc -l < "$TASKBOOK")
  log_info "════ MAIN LOOP ══════════════════════════════════════════"
  log_info "Taskbook: $total_tasks tasks"
  log_info "Phase filter: ${PHASE_FILTER:-ALL}"
  log_info "Start from:   ${START_FROM:-beginning}"
  log_info "Crash limit:  $CRASH_LOOP_LIMIT"
  log_info "Session:      $SESSION_NAME (pzo-build and road-to-1200 untouched)"
  log_info "════════════════════════════════════════════════════════"

  local started=0
  [[ -z "$START_FROM" ]] && started=1

  while IFS= read -r task_json; do
    [[ -z "$task_json" ]] && continue

    local task_id phase
    task_id=$(echo "$task_json" | python3 -c "import json,sys; print(json.load(sys.stdin)['task_id'])")
    phase=$(echo "$task_json"   | python3 -c "import json,sys; print(json.load(sys.stdin)['phase'])")

    # Start-from logic
    if [[ -n "$START_FROM" && "$started" -eq 0 ]]; then
      [[ "$task_id" == "$START_FROM" ]] && started=1 || continue
    fi

    # Phase filter
    if [[ -n "$PHASE_FILTER" && "$phase" != "$PHASE_FILTER" ]]; then
      continue
    fi

    # Already done?
    if [[ "$(is_completed "$task_id")" == "yes" ]]; then
      ((skipped++)) || true
      continue
    fi

    # Crash loop guard
    local crash_count; crash_count=$(get_crash_count)
    if [[ "$crash_count" -ge "$CRASH_LOOP_LIMIT" ]]; then
      log_error "CRASH LOOP DETECTED ($crash_count consecutive crashes). Stopping."
      log_error "Fix root cause then: bash $0 resume"
      log_error "Or reset crashes: bash $0 reset-crashes && bash $0 resume"
      exit 1
    fi

    # Execute with retries
    local attempt=0 success=0
    while [[ $attempt -lt $MAX_RETRIES ]]; do
      ((attempt++)) || true
      local updated_json; updated_json=$(echo "$task_json" | python3 -c "
import json,sys
t=json.load(sys.stdin)
t['retry_count']=$((attempt-1))
print(json.dumps(t))
")
      if execute_task "$updated_json"; then
        success=1
        ((processed++)) || true
        break
      else
        if [[ $attempt -lt $MAX_RETRIES ]]; then
          log_warn "  Attempt $attempt/$MAX_RETRIES failed — waiting 20s before retry..."
          sleep 20
          increment_crash > /dev/null
        fi
      fi
    done

    if [[ "$success" -eq 0 ]]; then
      ((errors++)) || true
      log_error "  PERMANENTLY FAILED: $task_id (after $MAX_RETRIES attempts)"
    fi

    # Progress report every 25 tasks
    if [[ $(( (processed + errors) % 25 )) -eq 0 && $(( processed + errors )) -gt 0 ]]; then
      local total_done=$(( processed + skipped ))
      local pct=$(( total_done * 100 / total_tasks ))
      log_info "═══ PROGRESS: $processed done | $skipped skipped | $errors errors | ${pct}% ═══"
    fi

  done < "$TASKBOOK"

  log_ok "════ RUN COMPLETE ══════════════════════════════════════"
  log_ok "  Processed: $processed | Skipped: $skipped | Errors: $errors"
  local ts; ts=$(date +%Y%m%d_%H%M%S)
  python3 -c "
import json, time
with open('$REPORT_DIR/deploy_run_${ts}.json', 'w') as f:
    json.dump({'completed_at': time.time(), 'processed': $processed, 'skipped': $skipped, 'errors': $errors}, f, indent=2)
"
  log_ok "  Report: $REPORT_DIR/deploy_run_${ts}.json"
}

# ── ENTRY ────────────────────────────────────────────────────
CMD="${1:-run}"
case "$CMD" in
  run)
    guard_sessions
    guard_taskbook
    init_state
    run_preflight
    main_loop
    ;;
  resume)
    guard_sessions
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
import json, time
s = json.load(open('$STATE_FILE'))
total = 1325
done  = len(s['completed'])
fail  = len(s['failed'])
pct   = int(done*100/total)
elapsed = time.time() - s.get('started_at', time.time())
rate = done / elapsed if elapsed > 0 and done > 0 else 0
eta  = int((total-done)/rate) if rate > 0 else 0
h,m  = eta//3600, (eta%3600)//60
print(f'── PZO DEPLOY STATUS ──────────────────')
print(f'  Completed : {done}/{total} ({pct}%)')
print(f'  Failed    : {fail}')
print(f'  Crashes   : {s.get(\"crash_count\",0)}')
print(f'  Current   : {s.get(\"current_task\",\"idle\")}')
print(f'  ETA       : {h}h {m}m')
if s[\"failed\"]:
    print(f'  Last fails:')
    for f in s[\"failed\"][-5:]:
        tid = f[\"task_id\"] if isinstance(f, dict) else f
        print(f'    {tid}')
"
    else
      echo "No state file found: $STATE_FILE"
    fi
    ;;
  reset-crashes)
    python3 -c "
import json
with open('$STATE_FILE','r+') as f:
    s=json.load(f)
    s['crash_count']=0
    s['failed']=[]
    f.seek(0); json.dump(s,f,indent=2); f.truncate()
print('Crash count and failed list reset.')
"
    ;;
  reset-all)
    echo "⚠️  This will reset ALL progress. Are you sure? (yes/no)"
    read -r confirm
    if [[ "$confirm" == "yes" ]]; then
      rm -f "$STATE_FILE"
      init_state
      echo "✅ State fully reset."
    else
      echo "Cancelled."
    fi
    ;;
  *)
    echo "Usage: $0 [run|resume|preflight|dry-run|status|reset-crashes|reset-all]"
    echo ""
    echo "Env vars:"
    echo "  TASKBOOK=path         Override taskbook path"
    echo "  PHASE_FILTER=PHASE    Run only one phase"
    echo "  START_FROM=TASK_ID    Resume from specific task"
    echo "  OLLAMA_MODEL=model    Override model"
    echo "  DRY_RUN=1             Dry run (no Ollama calls)"
    echo "  CRASH_LOOP_LIMIT=N    Crash limit (default 50)"
    ;;
esac
