#!/usr/bin/env python3
import json, os, subprocess, time, sys

R='\033[0m'; B='\033[1m'; DM='\033[2m'
CY='\033[1;36m'; GR='\033[1;32m'; YE='\033[1;33m'
RE='\033[1;31m'; MA='\033[1;35m'; BL='\033[1;34m'; WH='\033[1;37m'

STATE    = os.path.expanduser('~/.pzo_omega_runner_state.json')
TASKBOOK = os.path.expanduser('~/point_zero_one_master/pzo_orchestration/tasks/PZO_MULTIPLAYER_OMEGA_ALL_TASKS.ndjson')
LOG      = os.path.expanduser('~/.pzo_omega_runner.log')
TOTAL    = 270
W        = 72

def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout.strip()

# ── LOAD STATE ────────────────────────────────────────────────
try:
    s = json.load(open(STATE))
except Exception as e:
    print(f'{RE}Cannot read state: {e}{R}')
    print(f'{DM}Has the runner been started? Run: python3 ~/pzo_scripts/pzo_runner.py{R}')
    sys.exit(1)

done_set = set(s.get('completed', []))
done     = len(done_set)
fail     = len(s.get('failed', []))
crashes  = s.get('crashes', 0)
pct      = int(done * 100 / TOTAL)
sr       = 100 if (done+fail)==0 else int(done*100/(done+fail))
sr_col   = GR if sr>=95 else (YE if sr>=80 else RE)

# ── ETA ───────────────────────────────────────────────────────
eta_str = '0h 0m'
avg_str = 'calculating...'
times   = s.get('task_times', [])
if times and done > 0:
    avg_s     = sum(times[-30:]) / len(times[-30:])
    remaining = TOTAL - done
    eta_s     = int(avg_s * remaining)
    h, m      = eta_s // 3600, (eta_s % 3600) // 60
    eta_str   = f'{h}h {m}m'
    avg_str   = f'{avg_s:.0f}s/task'

# ── CURRENT + LAST WRITTEN ────────────────────────────────────
cur_task     = s.get('current_task', 'waiting...') or 'waiting...'
last_written = s.get('last_written', '(none yet)') or '(none yet)'
last_written = last_written.replace(os.path.expanduser('~/point_zero_one_master/'), '')

# ── PHASE BREAKDOWN ───────────────────────────────────────────
phases = {}
try:
    with open(TASKBOOK) as f:
        for line in f:
            line = line.strip()
            if not line: continue
            t = json.loads(line)
            ph = t['phase']
            phases.setdefault(ph, {'total': 0, 'done': 0})
            phases[ph]['total'] += 1
            if t['task_id'] in done_set:
                phases[ph]['done'] += 1
except Exception:
    phases = {}

PHASE_ORDER = [
    'PHASE_1_CHAT_ALLIANCE_FOUNDATION',
    'PHASE_2_SOCIAL_DEPTH',
    'PHASE_3_WAR_ENGINE',
    'PHASE_4_MONETIZATION_POLISH',
    'CROSS_CUTTING_PROGRAM_DELIVERY',
]

labels = {
    'PHASE_1_CHAT_ALLIANCE_FOUNDATION':  ('P01 Chat/Alliance', CY),
    'PHASE_2_SOCIAL_DEPTH':              ('P02 Social Depth ', GR),
    'PHASE_3_WAR_ENGINE':                ('P03 War Engine   ', YE),
    'PHASE_4_MONETIZATION_POLISH':       ('P04 Multiplayer  ', MA),
    'CROSS_CUTTING_PROGRAM_DELIVERY':    ('P05 Cross-Cutting', BL),
}

# ── SYSTEM HEALTH ─────────────────────────────────────────────
runner_proc = sh('ps aux | grep pzo_runner | grep -v grep')
ollama_ok   = subprocess.run('curl -sf http://localhost:11434/api/tags > /dev/null 2>&1',
                              shell=True).returncode == 0

# ── RENDER ────────────────────────────────────────────────────
now = time.strftime('%Y-%m-%d %H:%M:%S')
print(f'{CY}{"═"*W}{R}')
print(f'{B}{"  ⚡  SOVEREIGN DUAL RUNNER MONITOR  ⚡":^{W}}{R}')
print(f'{DM}{now:^{W}}{R}')
print(f'{CY}{"═"*W}{R}')

filled = int(pct / 2)
bar    = f'{GR}{"█"*filled}{DM}{"░"*(50-filled)}{R}'
print(f'\n  {DM}Progress{R}  [{bar}]  {YE}{B}{pct}%{R}  {WH}{B}{done}{R}{DM}/{TOTAL}{R}\n')

print(f'  {DM}✅ Completed  :{R} {GR}{B}{done:<8}{R}  {DM}⏱  ETA         :{R} {YE}{B}{eta_str}{R}')
print(f'  {DM}❌ Failed     :{R} {RE}{fail:<8}{R}  {DM}📈 Success Rate :{R} {sr_col}{B}{sr}%{R}')
print(f'  {DM}💥 Crashes    :{R} {YE}{crashes:<8}{R}  {DM}⚡ Avg Speed    :{R} {CY}{avg_str}{R}')

cur_display = f'{GR}ALL DONE{R}' if cur_task == 'DONE' else f'{CY}{cur_task[:48]}{R}'
print(f'  {DM}🔧 Current    :{R} {cur_display}')

print(f'\n  {DM}Last written:{R}')
print(f'    {GR}→{R} {WH}{last_written[:66]}{R}')

print(f'\n  {DM}Phase progress:{R}')
for ph in PHASE_ORDER:
    d = phases.get(ph, {'total': 0, 'done': 0})
    if d['total'] == 0:
        continue
    p        = int(d['done'] * 100 / d['total'])
    lbl, col = labels.get(ph, (ph[:17], DM))
    b        = f'{col}{"█"*int(p/4)}{DM}{"░"*(25-int(p/4))}{R}'
    print(f'    {col}{lbl}{R} [{b}] {col}{B}{p:3d}%{R}  {DM}{d["done"]}/{d["total"]}{R}')

print(f'\n{DM}{"─"*W}{R}')
if runner_proc:
    parts = runner_proc.split()
    pid = parts[1] if len(parts) > 1 else '?'
    cpu = parts[2] if len(parts) > 2 else '?'
    mem = parts[3] if len(parts) > 3 else '?'
    print(f'  {GR}●{R} {DM}pzo_runner    :{R} {GR}{B}ALIVE{R}  {DM}pid:{WH}{pid}{R}  {DM}cpu:{YE}{cpu}%{R}  {DM}mem:{YE}{mem}%{R}')
else:
    print(f'  {RE}●{R} {DM}pzo_runner    :{R} {RE}NOT RUNNING  →  python3 ~/pzo_scripts/pzo_runner.py{R}')

ol = f'{GR}{B}RUNNING{R}' if ollama_ok else f'{RE}{B}DOWN — run: ollama serve{R}'
print(f'  {"  " if ollama_ok else RE+"●"+R} {DM}Ollama        :{R} {ol}')

print(f'{CY}{"═"*W}{R}')
print(f'  {DM}Tiers: L0=phi3:mini  L1=mistral:7b  L2=qwen3:8b  L3=qwen2.5-coder:32b{R}')
print(f'  {DM}5s refresh  |  tmux attach -t pzo_omega  |  Ctrl+C stop{R}')
print(f'{CY}{"═"*W}{R}')
