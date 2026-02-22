#!/usr/bin/env python3
# ============================================================
# PZO DEPLOYMENT MONITOR v1.1 — SELF-REFRESHING
# Tracks master_taskbook_PZO_DEPLOYMENT_HOW_TO_DEPLOY_v1_0.ndjson
# 1325 tasks · 52 phases · Session: pzo-deploy
#
# Usage:
#   python3 pzo_deploy_monitor.py          # loop, 3s refresh
#   python3 pzo_deploy_monitor.py --once   # single render, exit
#   REFRESH=5 python3 pzo_deploy_monitor.py
# ============================================================
import json, os, subprocess, time, sys

REFRESH   = int(os.environ.get('REFRESH', 3))
LOOP_MODE = '--once' not in sys.argv

# ── ANSI ─────────────────────────────────────────────────────
R  = '\033[0m';   B  = '\033[1m';   DM = '\033[2m'
CY = '\033[1;36m'; GR = '\033[1;32m'; YE = '\033[1;33m'
RE = '\033[1;31m'; MA = '\033[1;35m'; BL = '\033[1;34m'
WH = '\033[1;37m'; DK = '\033[0;90m'

# ── PATHS ────────────────────────────────────────────────────
PZO_ROOT = os.environ.get(
    'PZO_ROOT',
    '/Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master'
)
AUTO_DIR = f'{PZO_ROOT}/pzo_complete_automation'
STATE    = os.environ.get('PZO_DEPLOY_STATE',    f'{AUTO_DIR}/runtime/pzo_deploy_state.json')
TASKBOOK = os.environ.get('PZO_DEPLOY_TASKBOOK', f'{AUTO_DIR}/master_taskbook_PZO_DEPLOYMENT_HOW_TO_DEPLOY_v1_0.ndjson')
LOG_DIR  = f'{AUTO_DIR}/runtime/logs/deploy'
TOTAL_TASKS = 1325

# ── PHASE LABELS ─────────────────────────────────────────────
PHASE_LABELS = {
    'PZO_INFRA_FOUNDATION_V1':                          ('INFRA Foundation  ', CY),
    'PZO_AUTH_IDENTITY_V1':                             ('Auth & Identity    ', BL),
    'PZO_GAME_CORE_ENGINE_V1':                          ('Game Core Engine   ', GR),
    'PZO_CONTENT_OPS_V1':                               ('Content Ops        ', MA),
    'PZO_BALANCE_TOOLING_V1':                           ('Balance Tooling    ', YE),
    'PZO_SHARE_ENGINE_V1':                              ('Share Engine       ', CY),
    'PZO_AFTER_ACTION_PLAN_V1':                         ('After Action Plan  ', GR),
    'PZO_TRUST_PROOF_RUN_EXPLORER':                     ('Trust & Proof      ', BL),
    'PZO_VERIFIED_BR_BUILD_V1':                         ('Verified BraggingR ', MA),
    'PZO_PVP_TWO_TIER_LADDER_TRUST_FIREWALL':           ('Two-Tier Ladder    ', YE),
    'PZO_LADDER_BUILD_V1':                              ('Ladder Build       ', RE),
    'PZO_SEASON0_FOUNDING_ERA_WAITLIST_ENGINE':         ('Season0 Waitlist   ', CY),
    'PZO_SEASON0_BUILD_V1':                             ('Season0 Build      ', GR),
    'PZO_CREATOR_ECONOMY_GOVERNED_PIPELINE_V1':         ('Creator Pipeline   ', MA),
    'PZO_CREATOR_ECONOMY_BUILD_V1':                     ('Creator Build      ', BL),
    'HOS_P00_LANDING':                                  ('Host OS Landing    ', YE),
    'HOS_P01_KIT_DELIVERY':                             ('Host Kit Delivery  ', CY),
    'HOS_P02_HOST_DASHBOARD':                           ('Host Dashboard     ', GR),
    'HOS_P03_MOMENT_INTEGRATION':                       ('Host Moments       ', MA),
    'HOS_P04_PRINTABLES':                               ('Host Printables    ', BL),
    'HOS_P05_ANALYTICS':                                ('Host Analytics     ', YE),
    'HOS_P06_SITE_INTEGRATION':                         ('Host Site Integ    ', RE),
    'HOS_P07_V2_STUBS':                                 ('Host V2 Stubs      ', DK),
    'PZO_MONETIZATION_ENGINE_V1':                       ('Monetization Eng   ', GR),
    'PZO_MONETIZATION_GOVERNANCE_OS_AND_LIVEOPS_EXCHANGE_LOOP_V1': ('Mon Governance    ', CY),
    'PZO_REMOTE_CONFIG_MONETIZATION_GOVERNANCE_V1':     ('Remote Config Mon  ', MA),
    'PZO_TELEMETRY_LIVEOPS_LOOP_V1':                    ('Telemetry LiveOps  ', BL),
    'PZO_LIVEOPS_WEEKLY_MACHINE_V1':                    ('LiveOps Weekly     ', YE),
    'PZO_NOTIFICATIONS_ENGAGEMENT_V1':                  ('Notifications      ', CY),
    'PZO_ONBOARDING_THREE_RUN_ARC_V1':                  ('Onboarding Arc     ', GR),
    'PZO_RELEASE_STAGES_V1':                            ('Release Stages     ', MA),
    'PZO_B2B_CORPORATE_WELLNESS_V1':                    ('B2B Corporate      ', BL),
    'PZO_CURRICULUM_SPINE_LICENSING_V1':                ('Curriculum License ', YE),
    'PZO_LICENSING_READY_CURRICULUM_SPINE_V1':          ('License Spine      ', RE),
    'PZO_PARTNER_DISTRIBUTION_CHANNELS_V1':             ('Partner Distrib    ', CY),
    'PZO_PHYSICAL_GAME_INTEGRATION_V1':                 ('Physical Game      ', GR),
    'PZO_LAUNCH_ARCHITECTURE_V1':                       ('Launch Arch        ', MA),
    'PZO_DEPLOYMENT_HOW_TO_DEPLOY_PLAYBOOK_V1':         ('Deploy Playbook    ', WH),
    'PZO_LOSS_IS_CONTENT_SYSTEM_V1':                    ('Loss Is Content    ', BL),
    'PZO_PUBLIC_INTEGRITY_PAGE_V1':                     ('Integrity Page     ', YE),
    'PZO_PUBLIC_INTEGRITY_PAGE_TRUST_MARKETING_V1':     ('Integrity Mktg     ', CY),
    'PZO_INTEGRITY_MARKETING_V1':                       ('Int Marketing V1   ', GR),
    'PZO_WEAPON1_BIOMETRIC_V1':                         ('WPN1 Biometric     ', RE),
    'PZO_WEAPON2_CARD_FORGE_V1':                        ('WPN2 Card Forge    ', RE),
    'PZO_WEAPON3_GENERATIONAL_V1':                      ('WPN3 Generational  ', RE),
    'PZO_WEAPON4_MACRO_SHOCK_V1':                       ('WPN4 Macro Shock   ', RE),
    'PZO_WEAPON5_FORENSIC_AUTOPSY_V1':                  ('WPN5 Forensic AI   ', RE),
    'PZO_WEAPON7_SENTIMENT_V1':                         ('WPN7 Sentiment     ', RE),
    'PZO_DATA_ML_INFRASTRUCTURE_V1':                    ('Data & ML Infra    ', MA),
    'PZO_MOBILE_APPS_V1':                               ('Mobile Apps        ', BL),
    'PZO_SECURITY_COMPLIANCE_V1':                       ('Security+Compliance', YE),
    'PZO_HOST_OS_KIT_BUILD_V1':                         ('Host OS Kit Build  ', CY),
    'PZO_QUALITY_GATES_V1':                             ('Quality Gates      ', GR),
}

def sh(cmd):
    try:
        return subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout.strip()
    except Exception:
        return ''

def render():
    # ── LOAD STATE ───────────────────────────────────────────
    try:
        with open(STATE) as f:
            s = json.load(f)
    except FileNotFoundError:
        os.system('clear')
        print(f'\n{RE}  State file not found:{R}')
        print(f'  {STATE}')
        print(f'\n  {YE}Start the runner:{R}')
        print(f'  bash {AUTO_DIR}/scripts/pzo/pzo_deploy_launch.sh\n')
        sys.stdout.flush()
        return
    except Exception as e:
        print(f'{RE}Cannot read state: {e}{R}')
        sys.stdout.flush()
        return

    done_set  = set(s.get('completed', []))
    fail_list = s.get('failed', [])
    done      = len(done_set)
    fail      = len(fail_list)
    crashes   = s.get('crash_count', 0)
    cur_task  = s.get('current_task') or 'idle'
    pct       = int(done * 100 / TOTAL_TASKS)
    sr        = 100 if (done + fail) == 0 else int(done * 100 / (done + fail))
    sr_col    = GR if sr >= 95 else (YE if sr >= 80 else RE)

    # ── ETA ──────────────────────────────────────────────────
    started = s.get('started_at', 0)
    eta_str = 'calculating...'
    avg_str = ''
    if started and done > 0:
        elapsed   = time.time() - started
        rate      = done / elapsed
        avg_s     = elapsed / done
        remaining = TOTAL_TASKS - done
        eta_s     = int(remaining / rate) if rate > 0 else 0
        h, m      = eta_s // 3600, (eta_s % 3600) // 60
        eta_str   = f'{h}h {m}m'
        avg_str   = f'{avg_s:.0f}s/task'

    # ── LAST FILES ───────────────────────────────────────────
    latest_log = sh(f'ls -t {LOG_DIR}/*.log 2>/dev/null | head -1')
    last_files = []
    if latest_log:
        raw = sh(f"grep 'Written:' '{latest_log}' 2>/dev/null | tail -4")
        for line in raw.split('\n'):
            if 'Written:' in line:
                p = line.split('Written:')[-1].strip().split('(')[0].strip()
                p = p.replace(PZO_ROOT + '/', '')
                last_files.append(p[:65])

    if latest_log and cur_task == 'idle':
        cur_raw = sh(f"grep '\\[TASK\\]' '{latest_log}' 2>/dev/null | tail -1")
        if cur_raw:
            parts = cur_raw.split('|')
            cur_task = parts[0].split('[TASK]')[-1].strip() if parts else cur_task

    # ── PHASE BREAKDOWN ──────────────────────────────────────
    phases_map = {}
    try:
        with open(TASKBOOK) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    t  = json.loads(line)
                    ph = t.get('phase', 'UNKNOWN')
                    phases_map.setdefault(ph, {'total': 0, 'done': 0})
                    phases_map[ph]['total'] += 1
                    if t['task_id'] in done_set:
                        phases_map[ph]['done'] += 1
                except Exception:
                    pass
    except Exception:
        pass

    # ── SYSTEM ───────────────────────────────────────────────
    deploy_alive = sh("tmux has-session -t pzo-deploy 2>/dev/null && echo YES || echo NO") == "YES"
    build_alive  = sh("tmux has-session -t pzo-build  2>/dev/null && echo YES || echo NO") == "YES"
    r1200_alive  = sh("tmux has-session -t road-to-1200 2>/dev/null && echo YES || echo NO") == "YES"
    ollama_ok    = subprocess.run(
        'curl -sf http://localhost:11434/api/tags > /dev/null 2>&1',
        shell=True
    ).returncode == 0

    # ── RENDER ───────────────────────────────────────────────
    now = time.strftime('%Y-%m-%d %H:%M:%S')
    W   = min(int(sh("tput cols 2>/dev/null || echo 76") or 76), 80)

    def hline(ch='═', col=CY):
        print(f'{col}{ch * W}{R}')

    # clear screen, cursor to top-left
    os.system('clear')

    hline()
    print(f'{B}{"  ⚡  SOVEREIGN DEPLOY MONITOR — PZO v1.1  ⚡":^{W}}{R}')
    print(f'{DM}{now:^{W}}{R}')
    hline()
    print()

    # progress bar
    filled = int(pct * 48 / 100)
    pbar   = f'{GR}{"█" * filled}{DM}{"░" * (48 - filled)}{R}'
    print(f'  {DM}Progress{R}  [{pbar}]  {YE}{B}{pct}%{R}  {WH}{B}{done}{R}{DM}/{TOTAL_TASKS}{R}')
    print()

    # stats grid
    print(f'  {DM}✅ Completed  :{R} {GR}{B}{done:<8}{R}  {DM}⏱  ETA          :{R} {YE}{B}{eta_str}{R}')
    print(f'  {DM}❌ Failed     :{R} {RE}{fail:<8}{R}  {DM}📈 Success Rate  :{R} {sr_col}{B}{sr}%{R}')
    print(f'  {DM}💥 Crashes    :{R} {YE}{crashes:<8}{R}  {DM}⚡ Avg Speed     :{R} {CY}{avg_str or "calculating..."}{R}')
    print(f'  {DM}🔧 Current    :{R} {CY}{cur_task[:52]}{R}')

    # last written files
    print()
    print(f'  {DM}Last written:{R}')
    if last_files:
        for lf in last_files:
            print(f'    {GR}→{R} {WH}{lf}{R}')
    else:
        print(f'    {DM}(none yet){R}')

    # phase bars
    print()
    print(f'  {DM}Phase progress:{R}')
    bar_w = 20
    for ph_key, ph_data in phases_map.items():
        total_ph = ph_data['total']
        done_ph  = ph_data['done']
        p        = int(done_ph * 100 / total_ph) if total_ph else 0
        lbl, col = PHASE_LABELS.get(ph_key, (ph_key[:19].ljust(19), DM))
        lbl      = lbl[:19].ljust(19)
        filled_b = int(p * bar_w / 100)
        b        = f'{col}{"█" * filled_b}{DM}{"░" * (bar_w - filled_b)}{R}'
        pct_col  = GR if p == 100 else (YE if p > 0 else DM)
        print(f'    {col}{lbl}{R} [{b}] {pct_col}{B}{p:3d}%{R}  {DM}{done_ph}/{total_ph}{R}')

    # failed tasks
    if fail_list:
        print()
        print(f'  {RE}Failed (last 5):{R}')
        for entry in fail_list[-5:]:
            if isinstance(entry, dict):
                print(f'    {RE}✗{R} {WH}{entry.get("task_id","?")}{R}  {DM}{entry.get("reason","?")}{R}')
            else:
                print(f'    {RE}✗{R} {WH}{entry}{R}')

    # system health
    print()
    hline('─', col=DM)
    sessions = [
        ('pzo-deploy    ', deploy_alive, '(this runner)'),
        ('pzo-build     ', build_alive,  '(prev runner)'),
        ('road-to-1200  ', r1200_alive,  ''),
    ]
    for name, alive, note in sessions:
        dot   = f'{GR}●{R}' if alive else f'{DK}○{R}'
        state = f'{GR}{B}ALIVE{R}' if alive else f'{DK}offline{R}'
        n     = f'  {DM}{note}{R}' if note else ''
        print(f'  {dot} {DM}{name}:{R} {state}{n}')

    ol_col = f'{GR}{B}RUNNING{R}' if ollama_ok else f'{RE}{B}DOWN — run: ollama serve{R}'
    print(f'  {"●" if ollama_ok else RE+"●"+R} {DM}Ollama        :{R} {ol_col}')

    print()
    hline()
    total_remain = TOTAL_TASKS - done - fail
    print(f'  {DM}Tasks remaining: {WH}{B}{total_remain}{R}  '
          f'{DM}│  {REFRESH}s refresh  │  '
          f'tmux attach -t pzo-deploy  │  Ctrl+C stop{R}')
    hline()
    sys.stdout.flush()


# ── ENTRY ────────────────────────────────────────────────────
if LOOP_MODE:
    try:
        while True:
            render()
            time.sleep(REFRESH)
    except KeyboardInterrupt:
        print(f'\n{DM}Monitor stopped.{R}\n')
else:
    render()
