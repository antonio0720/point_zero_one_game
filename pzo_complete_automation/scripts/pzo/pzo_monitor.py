#!/usr/bin/env python3
import json, os, subprocess, time, sys

R='\033[0m'; B='\033[1m'; DM='\033[2m'
CY='\033[1;36m'; GR='\033[1;32m'; YE='\033[1;33m'
RE='\033[1;31m'; MA='\033[1;35m'; BL='\033[1;34m'; WH='\033[1;37m'

PZO = os.environ.get('PZO', '/Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_complete_automation')
STATE    = f'{PZO}/runtime/pzo_taskbook_state.json'
TASKBOOK = f'{PZO}/master_taskbook_PZO_AUTOMATION_v1_3.ndjson'
LOG      = f'{PZO}/runtime/logs/taskbook/runner_live.log'
W = 72

def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout.strip()

# ── LOAD STATE ────────────────────────────────────────────────
try:
    s = json.load(open(STATE))
except Exception as e:
    print(f'{RE}Cannot read state: {e}{R}'); sys.exit(1)

done_set = set(s.get('completed', []))
total    = 500
done     = len(done_set)
fail     = len(s.get('failed', []))
crashes  = s.get('crash_count', 0)
pct      = int(done * 100 / total)
sr       = 100 if (done+fail)==0 else int(done*100/(done+fail))
sr_col   = GR if sr>=95 else (YE if sr>=80 else RE)

# ── ETA ───────────────────────────────────────────────────────
started  = s.get('started_at', 0)
eta_str  = 'calculating...'
avg_str  = ''
if started and done > 0:
    elapsed  = time.time() - started
    rate     = done / elapsed          # tasks/sec
    avg_s    = elapsed / done
    remaining = total - done
    eta_s    = int(remaining / rate)
    h, m     = eta_s//3600, (eta_s%3600)//60
    eta_str  = f'{h}h {m}m'
    avg_str  = f'{avg_s:.0f}s/task'

# ── LAST FILES ────────────────────────────────────────────────
raw = sh(f"grep 'Written:' {LOG} 2>/dev/null | tail -3")
last_files = []
for line in raw.split('\n'):
    if 'Written:' in line:
        p = line.split('Written:')[-1].strip().split('(')[0].strip()
        p = p.replace('/Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/','')
        last_files.append(p[:66])

# ── CURRENT TASK ──────────────────────────────────────────────
cur_raw = sh(f"grep '\\[TASK\\]' {LOG} 2>/dev/null | tail -1")
cur_task = 'working...'
if cur_raw:
    parts = cur_raw.split('|')
    cur_task = parts[0].replace('[TASK]','').strip() if parts else 'working...'

# ── PHASE BREAKDOWN ───────────────────────────────────────────
phases = {}
try:
    with open(TASKBOOK) as f:
        for line in f:
            line = line.strip()
            if not line: continue
            t = json.loads(line)
            ph = t['phase']
            phases.setdefault(ph, {'total':0,'done':0})
            phases[ph]['total'] += 1
            if t['task_id'] in done_set:
                phases[ph]['done'] += 1
except Exception as e:
    phases = {}

labels = {
    'PZO_P00_TASKBOOK_AUTOMATION':    ('P00 Automation ', CY),
    'PZO_P01_ENGINE_UPGRADE':         ('P01 Engine     ', GR),
    'PZO_P02_PERSISTENCE_LEADERBOARD':('P02 Persistence', BL),
    'PZO_P03_BROWSER_UI':             ('P03 Browser UI ', MA),
    'PZO_P04_MULTIPLAYER':            ('P04 Multiplayer', YE),
    'PZO_P05_ML_MONETIZATION':        ('P05 ML+Money   ', RE),
    'PZO_P06_LAUNCH_GTM':             ('P06 Launch     ', GR),
}

# ── SYSTEM ────────────────────────────────────────────────────
revops = sh('ps aux | grep autonomous_revops | grep -v grep')
ollama_ok = subprocess.run('curl -sf http://localhost:11434/api/tags > /dev/null 2>&1',
    shell=True).returncode == 0

# ── RENDER ────────────────────────────────────────────────────
now = time.strftime('%Y-%m-%d %H:%M:%S')
print(f'{CY}{"═"*W}{R}')
print(f'{B}{"  ⚡  SOVEREIGN DUAL RUNNER MONITOR  ⚡":^{W}}{R}')
print(f'{DM}{now:^{W}}{R}')
print(f'{CY}{"═"*W}{R}')

# Progress bar
filled = int(pct / 2)
bar    = f'{GR}{"█"*filled}{DM}{"░"*(50-filled)}{R}'
print(f'\n  {DM}Progress{R}  [{bar}]  {YE}{B}{pct}%{R}  {WH}{B}{done}{R}{DM}/500{R}\n')

# Stats grid
print(f'  {DM}✅ Completed  :{R} {GR}{B}{done:<8}{R}  {DM}⏱  ETA         :{R} {YE}{B}{eta_str}{R}')
print(f'  {DM}❌ Failed     :{R} {RE}{fail:<8}{R}  {DM}📈 Success Rate :{R} {sr_col}{B}{sr}%{R}')
print(f'  {DM}💥 Crashes    :{R} {YE}{crashes:<8}{R}  {DM}⚡ Avg Speed    :{R} {CY}{avg_str or "calculating..."}{R}')
print(f'  {DM}🔧 Current    :{R} {CY}{cur_task}{R}')

# Last files
print(f'\n  {DM}Last written:{R}')
if last_files:
    for f in last_files:
        print(f'    {GR}→{R} {WH}{f}{R}')
else:
    print(f'    {DM}(none yet){R}')

# Phase bars
print(f'\n  {DM}Phase progress:{R}')
for ph, d in phases.items():
    p   = int(d['done']*100/d['total']) if d['total'] else 0
    lbl, col = labels.get(ph, (ph[:15], DM))
    b   = f'{col}{"█"*int(p/4)}{DM}{"░"*(25-int(p/4))}{R}'
    print(f'    {col}{lbl}{R} [{b}] {col}{B}{p:3d}%{R}  {DM}{d["done"]}/{d["total"]}{R}')

# System health
print(f'\n{DM}{"─"*W}{R}')
if revops:
    parts = revops.split()
    pid, cpu, mem = parts[1], parts[2], parts[3]
    print(f'  {GR}●{R} {DM}road_to_1200  :{R} {GR}{B}ALIVE{R}  {DM}pid:{WH}{pid}{R}  {DM}cpu:{YE}{cpu}%{R}  {DM}mem:{YE}{mem}%{R}')
else:
    print(f'  {RE}●{R} {DM}road_to_1200  :{R} {RE}NOT DETECTED{R}')

ol = f'{GR}{B}RUNNING{R}' if ollama_ok else f'{RE}{B}DOWN — run: ollama serve{R}'
print(f'  {"  " if ollama_ok else RE+"●"+R} {DM}Ollama        :{R} {ol}')

print(f'{CY}{"═"*W}{R}')
print(f'  {DM}5s refresh  |  tmux attach -t pzo-build  |  Ctrl+C stop{R}')
print(f'{CY}{"═"*W}{R}')
