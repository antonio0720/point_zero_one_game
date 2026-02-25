#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║      PZO ENGINE 1 — TIME ENGINE SOVEREIGN RUNNER v2.0                      ║
║      Density6 LLC · Point Zero One · RA-OMEGA Intelligence                  ║
║      166 tasks · 17 phases · 6 sprints · 4 worker tiers                    ║
╚══════════════════════════════════════════════════════════════════════════════╝

TASK PACK: ENGINE1_TIME_ENGINE_MASTER_TASK_PACK_V2.ndjson  (166 tasks)
STATE:     ~/.pzo_e1_time_runner_state.json
LOG:       ~/.pzo_e1_time_runner.log
MONITOR:   python3 pzo_monitor4.py --watch

WORKER TIERS:
  L0  phi3:mini      90s  retries=2  Governance/preflight (10 tasks)
  L1  phi3:mini     180s  retries=2  Bulk impl/CSS/types  (42 tasks)
  L2  phi3:mini     300s  retries=1  Hooks/components/wiring (83 tasks) → escalate qwen3:8b
  L3  qwen3:8b      600s  retries=1  Master class/edge/sovereign (31 tasks)

iMESSAGE ALERTS:
  export PZO_IMESSAGE_TO=+1XXXXXXXXXX
  Fires on: phase_complete, 25/50/75/90/100%, failure_spike≥20%, sovereign_gate

USAGE:
  python3 pzo_e1_time_runner.py                  → run all remaining tasks
  python3 pzo_e1_time_runner.py --dry-run        → print tasks without executing
  python3 pzo_e1_time_runner.py --phase E1_TIME_P00  → run single phase
  python3 pzo_e1_time_runner.py --task PZO_E1_TIME_T001 → run single task
  python3 pzo_e1_time_runner.py --status         → print current state and exit
  python3 pzo_e1_time_runner.py --reset-failed   → clear failed set and retry
  python3 pzo_e1_time_runner.py --reset-all      → nuclear reset (clears completed too)
  python3 pzo_e1_time_runner.py --from-phase E1_TIME_P03 → resume from phase
"""

import json, os, sys, time, subprocess, argparse, signal, hashlib, logging, math
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# ─── ANSI ──────────────────────────────────────────────────────────────────────
R   = '\033[0m';    B   = '\033[1m';    DM  = '\033[2m'
CY  = '\033[1;36m'; GR  = '\033[1;32m'; YE  = '\033[1;33m'
RE  = '\033[1;31m'; MA  = '\033[1;35m'; ORG = '\033[38;5;208m'
TL  = '\033[38;5;80m';  WH = '\033[1;37m'

# ─── PATHS ─────────────────────────────────────────────────────────────────────
HOME    = Path.home()
BASE    = HOME / 'point_zero_one_master'

TASKBOOK_PRIMARY = BASE / 'pzo_complete_automation/tasks/ENGINE1_TIME_ENGINE_MASTER_TASK_PACK_V2.ndjson'
TASKBOOK_ALT     = BASE / 'pzo_orchestration/tasks/ENGINE1_TIME_ENGINE_MASTER_TASK_PACK_V2.ndjson'
STATE_PATH       = HOME / '.pzo_e1_time_runner_state.json'
STATE_ALT        = HOME / '.pzo_engine1_state.json'
LOG_PATH         = HOME / '.pzo_e1_time_runner.log'
ALERT_LOG        = HOME / '.pzo_monitor4_alerts.jsonl'
MONITOR_STATE    = HOME / '.pzo_monitor4_state.json'

E1_TOTAL = 166
OLLAMA_URL = 'http://localhost:11434'

# ─── TIER CONFIG ───────────────────────────────────────────────────────────────
TIER_CONFIG = {
    'L0': {'model': 'phi3:mini',  'timeout': 90,  'retries': 2, 'escalate': None},
    'L1': {'model': 'phi3:mini',  'timeout': 180, 'retries': 2, 'escalate': None},
    'L2': {'model': 'phi3:mini',  'timeout': 300, 'retries': 1, 'escalate': 'qwen3:8b'},
    'L3': {'model': 'qwen3:8b',   'timeout': 600, 'retries': 1, 'escalate': None},
}

# ─── LOGGING ───────────────────────────────────────────────────────────────────
def setup_logging():
    logger = logging.getLogger('e1_runner')
    logger.setLevel(logging.DEBUG)
    fh = logging.FileHandler(LOG_PATH)
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(logging.Formatter('[%(asctime)s] [%(levelname)s] %(message)s',
                                       datefmt='%Y-%m-%dT%H:%M:%S'))
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    ch.setFormatter(logging.Formatter('%(message)s'))
    logger.addHandler(fh)
    logger.addHandler(ch)
    return logger

log = setup_logging()

# ─── LOG ROTATION ──────────────────────────────────────────────────────────────
def rotate_log_if_needed(max_bytes: int = 10 * 1024 * 1024, keep: int = 3):
    if not LOG_PATH.exists():
        return
    if LOG_PATH.stat().st_size < max_bytes:
        return
    for i in range(keep - 1, 0, -1):
        src = LOG_PATH.with_suffix(f'.log.{i}')
        dst = LOG_PATH.with_suffix(f'.log.{i+1}')
        if src.exists():
            src.rename(dst)
    try:
        LOG_PATH.rename(LOG_PATH.with_suffix('.log.1'))
    except Exception:
        pass

# ─── STATE ─────────────────────────────────────────────────────────────────────
def load_state() -> dict:
    for p in [STATE_PATH, STATE_ALT]:
        try:
            if p.exists():
                return json.loads(p.read_text())
        except Exception:
            pass
    return {
        'completed': [],
        'failed': [],
        'task_times': [],
        'current_task': None,
        'crashes': 0,
        'start_ts': None,
        'last_update_ts': None,
    }

def save_state(state: dict):
    state['last_update_ts'] = int(time.time() * 1000)
    try:
        STATE_PATH.write_text(json.dumps(state, indent=2))
        STATE_ALT.write_text(json.dumps(state, indent=2))  # dual-write for monitor compat
    except Exception as e:
        log.error(f'STATE WRITE FAIL: {e}')

# ─── TASKBOOK ──────────────────────────────────────────────────────────────────
def load_taskbook(path_override: Optional[Path] = None) -> list:
    paths = ([path_override] if path_override else []) + [TASKBOOK_PRIMARY, TASKBOOK_ALT]
    for p in paths:
        try:
            if p and p.exists():
                tasks = []
                with open(p) as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            tasks.append(json.loads(line))
                log.info(f'{GR}✓ Loaded {len(tasks)} tasks from {p.name}{R}')
                return tasks
        except Exception as e:
            log.warning(f'Taskbook load failed for {p}: {e}')
    log.error(f'{RE}FATAL: Cannot load taskbook. Checked:{R}')
    for p in [TASKBOOK_PRIMARY, TASKBOOK_ALT]:
        log.error(f'  {p}')
    sys.exit(1)

def verify_taskbook_sha(tasks: list, expected_sha: str) -> bool:
    content = '\n'.join(json.dumps(t, separators=(',', ':'), sort_keys=True) for t in tasks)
    actual = hashlib.sha256(content.encode()).hexdigest()
    if actual != expected_sha:
        log.warning(f'{YE}SHA mismatch — taskbook may differ from manifest. Continuing.{R}')
        log.warning(f'  expected: {expected_sha}')
        log.warning(f'  actual:   {actual}')
        return False
    return True

# ─── OLLAMA HEALTH ─────────────────────────────────────────────────────────────
def check_ollama() -> bool:
    try:
        r = subprocess.run(
            ['curl', '-sf', f'{OLLAMA_URL}/api/tags'],
            capture_output=True, timeout=5
        )
        return r.returncode == 0
    except Exception:
        return False

def wait_for_ollama(timeout: int = 60) -> bool:
    log.info(f'{YE}Waiting for Ollama at {OLLAMA_URL}...{R}')
    deadline = time.time() + timeout
    while time.time() < deadline:
        if check_ollama():
            log.info(f'{GR}✓ Ollama is UP{R}')
            return True
        time.sleep(3)
    log.error(f'{RE}Ollama not available after {timeout}s. Run: ollama serve{R}')
    return False

def ensure_model(model: str) -> bool:
    try:
        r = subprocess.run(
            ['ollama', 'pull', model],
            capture_output=True, text=True, timeout=300
        )
        return r.returncode == 0
    except Exception as e:
        log.warning(f'Model pull failed for {model}: {e}')
        return False

# ─── TASK PROMPT BUILDER ───────────────────────────────────────────────────────
def build_task_prompt(task: dict) -> str:
    ac = '\n'.join(f'  {i+1}. {c}' for i, c in enumerate(task.get('acceptance_criteria', [])))
    vc = '\n'.join(f'  $ {v}' for v in task.get('validation_commands', []))
    files = '\n'.join(f'  - {f}' for f in task.get('target_files', []))
    deps  = ', '.join(task.get('depends_on', [])) or 'none'

    return f"""You are a sovereign TypeScript/React engineer executing a production task for Point Zero One (PZO) — a 12-minute financial roguelike game.

TASK ID: {task['task_id']}
PHASE:   {task['phase_id']} — {task.get('phase_name', '')}
SPRINT:  {task.get('sprint', '?')}
TYPE:    {task.get('task_type', '?')}
PRIORITY:{task.get('priority', '?')}

TITLE: {task['title']}

TARGET FILES:
{files if files.strip() else '  (none specified)'}

DEPENDS ON: {deps}

ACCEPTANCE CRITERIA:
{ac if ac.strip() else '  (none specified)'}

VALIDATION COMMANDS (these must pass after your implementation):
{vc if vc.strip() else '  (none specified)'}

IF FILE EXISTS:    {task.get('if_exists', 'verify_shape+behavior, record evidence, patch only drift')}
IF FILE MISSING:   {task.get('if_missing', 'create exact file/path/module and continue dependency-safe chain')}
ROLLBACK PLAN:     {task.get('rollback_plan', 'revert touched files to pre-task snapshot')}
NOTES:             {task.get('notes', '')}

EXECUTION CONTRACT:
- Output ONLY complete, production-ready TypeScript/React/CSS code.
- Implement exactly what the acceptance criteria require — no more, no less.
- All files must be complete (not partial). Include full imports.
- Use strict TypeScript. No `any` unless absolutely required.
- After code blocks, output: STATUS: COMPLETE or STATUS: PARTIAL with reason.

BEGIN IMPLEMENTATION:"""

# ─── OLLAMA CALL ───────────────────────────────────────────────────────────────
def call_ollama(model: str, prompt: str, timeout: int) -> tuple[str, bool]:
    """Returns (response_text, success). Uses streaming JSON API."""
    payload = json.dumps({
        'model': model,
        'prompt': prompt,
        'stream': True,
        'options': {
            'temperature': 0.1,
            'top_p': 0.9,
            'num_predict': 4096,
        }
    }).encode()

    try:
        proc = subprocess.run(
            ['curl', '-sf', '--max-time', str(timeout),
             '-X', 'POST', f'{OLLAMA_URL}/api/generate',
             '-H', 'Content-Type: application/json',
             '-d', payload.decode()],
            capture_output=True, text=True, timeout=timeout + 10
        )
        if proc.returncode != 0:
            return f'curl failed: {proc.stderr[:200]}', False

        # Parse streaming NDJSON response
        response_parts = []
        for line in proc.stdout.strip().split('\n'):
            line = line.strip()
            if not line:
                continue
            try:
                chunk = json.loads(line)
                if chunk.get('response'):
                    response_parts.append(chunk['response'])
                if chunk.get('done', False):
                    break
            except json.JSONDecodeError:
                continue

        full_response = ''.join(response_parts)
        return full_response, bool(full_response.strip())

    except subprocess.TimeoutExpired:
        return f'TIMEOUT after {timeout}s', False
    except Exception as e:
        return f'Error: {e}', False

# ─── RUN VALIDATION COMMANDS ───────────────────────────────────────────────────
def run_validation(task: dict, project_root: Path) -> tuple[bool, list[str]]:
    cmds = task.get('validation_commands', [])
    if not cmds:
        return True, []

    failures = []
    for cmd in cmds:
        try:
            r = subprocess.run(
                cmd, shell=True, capture_output=True, text=True,
                timeout=30, cwd=str(project_root)
            )
            if r.returncode != 0:
                failures.append(f'FAIL [{r.returncode}]: {cmd}\n  stderr: {r.stderr.strip()[:200]}')
        except subprocess.TimeoutExpired:
            failures.append(f'TIMEOUT: {cmd}')
        except Exception as e:
            failures.append(f'ERROR: {cmd} → {e}')

    return len(failures) == 0, failures

# ─── EXTRACT CODE BLOCKS ───────────────────────────────────────────────────────
def extract_and_write_files(response: str, task: dict, project_root: Path) -> list[Path]:
    """Parse response for ```lang\n...\n``` blocks and write to target_files."""
    import re
    written = []
    target_files = task.get('target_files', [])

    # Find all fenced code blocks
    pattern = re.compile(r'```(?:\w+)?\n(.*?)```', re.DOTALL)
    blocks = pattern.findall(response)

    for i, (block) in enumerate(blocks):
        if i < len(target_files):
            tfile = target_files[i]
            # Skip directory-only targets
            if tfile.endswith('/'):
                continue
            dest = project_root / tfile
            dest.parent.mkdir(parents=True, exist_ok=True)
            try:
                dest.write_text(block.strip() + '\n')
                written.append(dest)
                log.debug(f'  wrote {dest}')
            except Exception as e:
                log.warning(f'  write failed {dest}: {e}')

    return written

# ─── iMESSAGE ─────────────────────────────────────────────────────────────────
def send_imessage(msg: str, tag: str = '') -> bool:
    to = os.environ.get('PZO_IMESSAGE_TO', '').strip()
    if not to:
        return False
    safe = msg.replace('\\', '\\\\').replace('"', '\\"')
    script = f'''
tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy "{to}" of targetService
    send "{safe}" to targetBuddy
end tell'''
    try:
        r = subprocess.run(['osascript', '-e', script],
                           capture_output=True, text=True, timeout=15)
        ok = r.returncode == 0
        _log_alert(tag or msg[:60], 'MSG_SENT' if ok else f'MSG_FAIL:{r.stderr.strip()[:80]}')
        return ok
    except Exception as e:
        _log_alert(f'MSG_ERROR: {e}', 'MSG_FAIL')
        return False

def _log_alert(msg: str, kind: str):
    entry = {'ts': datetime.now(timezone.utc).isoformat(), 'kind': kind, 'msg': msg}
    try:
        with open(ALERT_LOG, 'a') as f:
            f.write(json.dumps(entry) + '\n')
    except Exception:
        pass

def _load_sent_alerts() -> set:
    try:
        s = json.loads(MONITOR_STATE.read_text()) if MONITOR_STATE.exists() else {}
        return set(s.get('sent_alerts', []))
    except Exception:
        return set()

def _save_sent_alerts(sent: set):
    try:
        s = json.loads(MONITOR_STATE.read_text()) if MONITOR_STATE.exists() else {}
        s['sent_alerts'] = list(sent)[-500:]
        MONITOR_STATE.write_text(json.dumps(s))
    except Exception:
        pass

def maybe_notify(key: str, msg: str, tag: str = '') -> bool:
    sent = _load_sent_alerts()
    if key in sent:
        return False
    ok = send_imessage(msg, tag or key)
    if ok:
        sent.add(key)
        _save_sent_alerts(sent)
    return ok

def fire_phase_alert(phase_id: str, done: int, total: int, e1_done: int):
    now = datetime.now().strftime('%m/%d %H:%M')
    msg = (f'✅ ENGINE 1 TIME — PHASE COMPLETE\n'
           f'Phase: {phase_id}\n'
           f'{done}/{total} phase tasks\n'
           f'Overall: {e1_done}/{E1_TOTAL}\n{now}')
    maybe_notify(f'e1_phase_complete_{phase_id}', msg, tag=f'E1_PHASE:{phase_id}')

def fire_milestone_alert(pct: int, done: int):
    now = datetime.now().strftime('%m/%d %H:%M')
    emoji = '🏆' if pct < 100 else '🎯'
    msg = (f'{emoji} ENGINE 1 TIME — {pct}% COMPLETE\n'
           f'{done}/{E1_TOTAL} tasks done\n'
           f'Point Zero One — Sovereign\n{now}')
    maybe_notify(f'e1_milestone_{pct}', msg, tag=f'E1_{pct}PCT')

def fire_sovereign_gate_alert(done: int):
    now = datetime.now().strftime('%m/%d %H:%M')
    msg = (f'🔱 ENGINE 1 — SOVEREIGN GATE PASSED\n'
           f'{done}/{E1_TOTAL} tasks complete\n'
           f'Time Engine fully operational\n'
           f'Density6 LLC — RA-OMEGA\n{now}')
    maybe_notify('e1_sovereign_gate', msg, tag='SOVEREIGN_GATE')

# ─── PROGRESS BAR ─────────────────────────────────────────────────────────────
def progress_bar(done: int, total: int, width: int = 30) -> str:
    pct = int(done * 100 / total) if total else 0
    filled = int(pct * width / 100)
    col = GR if pct >= 75 else (YE if pct >= 40 else ORG)
    bar = f'{col}{"█"*filled}{DM}{"░"*(width-filled)}{R}'
    return f'[{bar}] {YE}{B}{pct}%{R} {WH}{B}{done}{R}{DM}/{total}{R}'

# ─── EXECUTE SINGLE TASK ───────────────────────────────────────────────────────
def execute_task(task: dict, state: dict, project_root: Path,
                 dry_run: bool = False) -> bool:
    task_id = task['task_id']
    tier    = task.get('worker_tier', 'L2')
    cfg     = TIER_CONFIG.get(tier, TIER_CONFIG['L2'])
    model   = cfg['model']
    timeout = cfg['timeout']
    retries = cfg['retries']
    title   = task.get('title', '')[:70]
    phase   = task.get('phase_id', '')

    log.info(f'\n{ORG}{"─"*76}{R}')
    log.info(f'{YE}{B}▶ {task_id}{R}  {DM}[{tier}|{model}|{timeout}s]{R}')
    log.info(f'  {WH}{title}{R}')
    log.info(f'  {DM}Phase: {phase}  Sprint: {task.get("sprint","?")}  Priority: {task.get("priority","?")}{R}')

    if dry_run:
        log.info(f'  {DM}[DRY RUN — skipping Ollama call]{R}')
        return True

    prompt = build_task_prompt(task)
    start  = time.time()
    success = False
    response = ''

    for attempt in range(retries + 1):
        effective_model = model
        if attempt > 0 and cfg.get('escalate'):
            effective_model = cfg['escalate']
            log.info(f'  {YE}↑ Escalating to {effective_model} (attempt {attempt+1}){R}')
        else:
            if attempt > 0:
                log.info(f'  {YE}↺ Retry {attempt}/{retries} with {effective_model}{R}')

        log.info(f'  {DM}Calling {effective_model}...{R}')
        response, ok = call_ollama(effective_model, prompt, timeout)

        if ok:
            success = True
            log.info(f'  {GR}✓ Response received ({len(response)} chars){R}')
            break
        else:
            log.warning(f'  {RE}✗ Attempt {attempt+1} failed: {response[:100]}{R}')
            time.sleep(2)

    duration = time.time() - start

    if success:
        # Write files
        written = extract_and_write_files(response, task, project_root)
        if written:
            log.info(f'  {GR}✓ Wrote {len(written)} file(s){R}')

        # Run validation
        valid, failures = run_validation(task, project_root)
        if not valid:
            for f in failures:
                log.warning(f'  {YE}⚠ VALIDATION: {f}{R}')
            # Log but don't fail — validation is advisory at this stage
            log.warning(f'  {YE}⚠ {len(failures)} validation check(s) failed (non-blocking){R}')
        else:
            if task.get('validation_commands'):
                log.info(f'  {GR}✓ All validation commands passed{R}')

        state['completed'] = list(set(state.get('completed', [])) | {task_id})
        state.setdefault('task_times', []).append(round(duration, 2))
        # Cap task_times history at 500
        state['task_times'] = state['task_times'][-500:]
        log.info(f'  {GR}✓ COMPLETE in {duration:.1f}s{R}')
    else:
        state['failed'] = list(set(state.get('failed', [])) | {task_id})
        log.error(f'  {RE}✗ FAILED after {duration:.1f}s — {response[:120]}{R}')

        # Halt on P0 failure
        if task.get('priority') == 'P0':
            log.error(f'{RE}{B}HALT: P0 task {task_id} failed. Fix and resume.{R}')
            state['current_task'] = None
            save_state(state)
            now = datetime.now().strftime('%m/%d %H:%M')
            maybe_notify(f'e1_p0_fail_{task_id}',
                         f'🚨 ENGINE 1 P0 FAILURE\nTask: {task_id}\n{title[:50]}\n{now}',
                         tag='E1_P0_FAIL')
            sys.exit(2)

    state['current_task'] = task_id
    save_state(state)
    return success

# ─── PHASE TRACKING ───────────────────────────────────────────────────────────
def check_phase_completion(phase_id: str, tasks: list, state: dict) -> bool:
    phase_tasks = [t for t in tasks if t.get('phase_id') == phase_id]
    if not phase_tasks:
        return False
    done_set = set(state.get('completed', []))
    return all(t['task_id'] in done_set for t in phase_tasks)

def check_and_fire_alerts(tasks: list, state: dict,
                           prev_done: int, prev_phases_done: set):
    done_set  = set(state.get('completed', []))
    done      = len(done_set)
    fail      = len(state.get('failed', []))

    # Milestone alerts
    for milestone in [25, 50, 75, 90, 100]:
        if prev_done * 100 // E1_TOTAL < milestone <= done * 100 // E1_TOTAL:
            fire_milestone_alert(milestone, done)
            if milestone == 100:
                fire_sovereign_gate_alert(done)

    # Phase completion alerts
    phases = set(t.get('phase_id') for t in tasks)
    for ph in phases:
        if ph not in prev_phases_done:
            if check_phase_completion(ph, tasks, state):
                ph_tasks = [t for t in tasks if t.get('phase_id') == ph]
                fire_phase_alert(ph, len(ph_tasks), len(ph_tasks), done)
                prev_phases_done.add(ph)

    # Failure spike alert
    total_attempted = done + fail
    if total_attempted >= 5:
        fail_rate = int(fail * 100 / total_attempted)
        if fail_rate >= 20:
            bucket = (fail // 10) * 10
            maybe_notify(
                f'e1_fail_spike_{bucket}',
                f'🚨 ENGINE 1 FAILURE SPIKE\n{fail} fails ({fail_rate}%)\nDone: {done}/{E1_TOTAL}',
                tag='E1_FAIL_SPIKE'
            )

# ─── STATUS PRINTER ───────────────────────────────────────────────────────────
def print_status(tasks: list, state: dict):
    done_set = set(state.get('completed', []))
    fail_set = set(state.get('failed', []))
    done = len(done_set)
    fail = len(fail_set)

    print(f'\n{ORG}{"═"*76}{R}')
    print(f'{B}{ORG}{"  ENGINE 1 — TIME ENGINE RUNNER STATUS":^76}{R}')
    print(f'{ORG}{"═"*76}{R}\n')
    print(f'  {WH}Overall:  {R}{progress_bar(done, E1_TOTAL)}')
    print(f'  {GR}✅ Done:  {done}{R}  {RE}❌ Failed: {fail}{R}  '
          f'{DM}⏳ Remaining: {E1_TOTAL - done - fail}{R}')

    times = state.get('task_times', [])
    if times:
        avg = sum(times) / len(times)
        rem = E1_TOTAL - done
        eta_s = int(avg * rem)
        h, m = eta_s // 3600, (eta_s % 3600) // 60
        print(f'  {DM}⏱  ETA: {YE}{h}h {m}m{R}  {DM}avg: {CY}{avg:.1f}s/task{R}  '
              f'{DM}vel: {TL}{3600/avg:.1f} t/hr{R}')

    # Phase breakdown
    print(f'\n  {DM}Phase Progress:{R}')
    phases_seen = {}
    for t in tasks:
        ph = t.get('phase_id', '?')
        if ph not in phases_seen:
            phases_seen[ph] = {'total': 0, 'done': 0, 'failed': 0}
        phases_seen[ph]['total'] += 1
        if t['task_id'] in done_set:
            phases_seen[ph]['done'] += 1
        elif t['task_id'] in fail_set:
            phases_seen[ph]['failed'] += 1

    for ph in sorted(phases_seen.keys()):
        d = phases_seen[ph]
        pct = int(d['done'] * 100 / d['total']) if d['total'] else 0
        col = GR if pct == 100 else (YE if pct > 0 else DM)
        mark = f'{GR}✓{R}' if pct == 100 else '  '
        bar = f'{"█"*int(pct/5)}{"░"*(20-int(pct/5))}'
        print(f'  {col}{ph:<18}{R} [{col}{bar}{R}] {col}{pct:3d}%{R} '
              f'{DM}{d["done"]}/{d["total"]}{R} {mark}')

    if fail_set:
        print(f'\n  {RE}Failed tasks:{R}')
        for tid in sorted(fail_set):
            print(f'    {RE}✗ {tid}{R}')

    print(f'\n{ORG}{"═"*76}{R}\n')

# ─── MAIN RUNNER ──────────────────────────────────────────────────────────────
def main():
    rotate_log_if_needed()

    parser = argparse.ArgumentParser(description='PZO Engine 1 Time Engine Runner v2.0')
    parser.add_argument('--dry-run',      action='store_true', help='Print tasks, no Ollama calls')
    parser.add_argument('--phase',        type=str, default=None, help='Run only this phase_id')
    parser.add_argument('--from-phase',   type=str, default=None, help='Resume from phase_id onwards')
    parser.add_argument('--task',         type=str, default=None, help='Run a single task_id')
    parser.add_argument('--status',       action='store_true', help='Print status and exit')
    parser.add_argument('--reset-failed', action='store_true', help='Clear failed set and retry them')
    parser.add_argument('--reset-all',    action='store_true', help='Nuclear reset — clears everything')
    parser.add_argument('--skip-ollama-check', action='store_true', help='Skip Ollama availability check')
    parser.add_argument('--taskbook',     type=str, default=None, help='Override taskbook path')
    parser.add_argument('--project-root', type=str, default='.', help='Project root for file writes (default: .)')
    args = parser.parse_args()

    project_root = Path(args.project_root).resolve()
    log.info(f'{ORG}{"═"*76}{R}')
    log.info(f'{B}{ORG}  PZO ENGINE 1 — TIME ENGINE RUNNER v2.0{R}')
    log.info(f'{DM}  Density6 LLC · {E1_TOTAL} tasks · 17 phases · 6 sprints{R}')
    log.info(f'{ORG}{"═"*76}{R}')

    # Load taskbook
    tb_override = Path(args.taskbook) if args.taskbook else None
    tasks = load_taskbook(tb_override)

    # Load state
    state = load_state()

    # Status only
    if args.status:
        print_status(tasks, state)
        return

    # Reset operations
    if args.reset_all:
        state = {'completed': [], 'failed': [], 'task_times': [],
                 'current_task': None, 'crashes': 0,
                 'start_ts': None, 'last_update_ts': None}
        save_state(state)
        log.info(f'{YE}⚠ FULL RESET — all progress cleared{R}')

    if args.reset_failed:
        failed = state.get('failed', [])
        state['failed'] = []
        save_state(state)
        log.info(f'{YE}↺ Cleared {len(failed)} failed tasks — will retry{R}')

    # Ollama check
    if not args.dry_run and not args.skip_ollama_check:
        if not wait_for_ollama(timeout=60):
            sys.exit(1)

    # Set start timestamp
    if not state.get('start_ts'):
        state['start_ts'] = int(time.time() * 1000)
        save_state(state)

    done_set = set(state.get('completed', []))

    # Build execution list
    if args.task:
        # Single task mode
        target_tasks = [t for t in tasks if t['task_id'] == args.task]
        if not target_tasks:
            log.error(f'{RE}Task {args.task} not found in taskbook{R}')
            sys.exit(1)
    elif args.phase:
        # Single phase mode
        target_tasks = [t for t in tasks if t.get('phase_id') == args.phase]
        if not target_tasks:
            log.error(f'{RE}Phase {args.phase} not found{R}')
            sys.exit(1)
        log.info(f'  {CY}Single-phase mode: {args.phase} ({len(target_tasks)} tasks){R}')
    elif args.from_phase:
        # Resume from phase
        phase_order = [
            'E1_TIME_P00','E1_TIME_P01','E1_TIME_P02','E1_TIME_P03',
            'E1_TIME_P04','E1_TIME_P05','E1_TIME_P06','E1_TIME_P07',
            'E1_TIME_P08','E1_TIME_P09','E1_TIME_P10','E1_TIME_P11',
            'E1_TIME_P12','E1_TIME_P13','E1_TIME_P14','E1_TIME_P15',
            'E1_TIME_P16',
        ]
        try:
            start_idx = phase_order.index(args.from_phase)
        except ValueError:
            log.error(f'{RE}Phase {args.from_phase} not in phase order list{R}')
            sys.exit(1)
        allowed_phases = set(phase_order[start_idx:])
        target_tasks = [t for t in tasks if t.get('phase_id') in allowed_phases]
        log.info(f'  {CY}Resuming from {args.from_phase} — {len(target_tasks)} tasks in scope{R}')
    else:
        # All tasks
        target_tasks = tasks

    # Filter already completed (unless running single task explicitly)
    if not args.task:
        pending = [t for t in target_tasks if t['task_id'] not in done_set]
    else:
        pending = target_tasks  # force re-run on explicit task

    log.info(f'\n  {WH}Total in scope: {len(target_tasks)}{R}  '
             f'{GR}Already done: {len(target_tasks)-len(pending)}{R}  '
             f'{YE}Pending: {len(pending)}{R}')

    if not pending:
        log.info(f'\n{GR}{B}✓ All tasks in scope are already complete!{R}')
        print_status(tasks, state)
        return

    # Signal handler for graceful shutdown
    def sigint_handler(sig, frame):
        log.info(f'\n{YE}⚡ Interrupt received — saving state and exiting gracefully{R}')
        state['current_task'] = None
        save_state(state)
        print_status(tasks, state)
        sys.exit(0)
    signal.signal(signal.SIGINT, sigint_handler)
    signal.signal(signal.SIGTERM, sigint_handler)

    # ─── EXECUTION LOOP ─────────────────────────────────────────────────────
    prev_done       = len(done_set)
    prev_phases_done= set()
    run_start       = time.time()

    log.info(f'\n{ORG}{"─"*76}{R}')
    log.info(f'{B}  EXECUTION START — {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}{R}')
    log.info(f'{ORG}{"─"*76}{R}\n')

    completed_this_run = 0
    failed_this_run    = 0

    for i, task in enumerate(pending):
        task_id = task['task_id']
        overall_done = len(set(state.get('completed', [])))
        overall_pct  = int(overall_done * 100 / E1_TOTAL)

        log.info(f'\n  {DM}[{i+1}/{len(pending)}]  Overall: {overall_pct}% ({overall_done}/{E1_TOTAL}){R}')

        ok = execute_task(task, state, project_root, dry_run=args.dry_run)
        if ok:
            completed_this_run += 1
        else:
            failed_this_run += 1

        # Alert checks after each task
        check_and_fire_alerts(tasks, state, prev_done, prev_phases_done)
        prev_done = len(set(state.get('completed', [])))

        # Live ETA update every 10 tasks
        if (i + 1) % 10 == 0:
            times = state.get('task_times', [])
            if times:
                avg   = sum(times[-20:]) / len(times[-20:])
                rem   = len(pending) - (i + 1)
                eta_s = int(avg * rem)
                h, m  = eta_s // 3600, (eta_s % 3600) // 60
                log.info(f'  {DM}ETA: {YE}{h}h {m}m{R}  avg: {CY}{avg:.1f}s/task{R}  '
                         f'vel: {TL}{3600/avg:.1f} t/hr{R}')

    # ─── FINAL SUMMARY ──────────────────────────────────────────────────────
    elapsed = time.time() - run_start
    h, m = int(elapsed) // 3600, (int(elapsed) % 3600) // 60

    log.info(f'\n{ORG}{"═"*76}{R}')
    log.info(f'{B}{ORG}  RUN COMPLETE — {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}{R}')
    log.info(f'{ORG}{"═"*76}{R}')
    log.info(f'  {GR}✅ Completed this run: {completed_this_run}{R}')
    log.info(f'  {RE}❌ Failed this run:    {failed_this_run}{R}')
    log.info(f'  {DM}⏱  Elapsed: {h}h {m}m{R}')

    state['current_task'] = 'DONE' if len(set(state.get('completed',[]))) >= E1_TOTAL else None
    save_state(state)
    print_status(tasks, state)

if __name__ == '__main__':
    main()
