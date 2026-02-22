#!/usr/bin/env bash
# ============================================================
# SOVEREIGN DUAL RUNNER MONITOR
# Watches both revops (autonomous_revops_runner) + PZO build
# Refresh: every 5s via watch
# Usage: bash pzo_dual_monitor.sh
# ============================================================

PZO=/Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_complete_automation
PZO_STATE="$PZO/runtime/pzo_taskbook_state.json"
PZO_LOG_DIR="$PZO/runtime/logs/taskbook"
REVOPS_LOG="${REVOPS_LOG:-}"  # auto-detected below

# ─── COLORS ──────────────────────────────────────────────────
RESET='\033[0m'; BOLD='\033[1m'; DIM='\033[2m'
BLACK='\033[0;30m'; RED='\033[0;31m'; GREEN='\033[0;32m'
YELLOW='\033[0;33m'; BLUE='\033[0;34m'; MAGENTA='\033[0;35m'
CYAN='\033[0;36m'; WHITE='\033[0;37m'
BGREEN='\033[1;32m'; BRED='\033[1;31m'; BYELLOW='\033[1;33m'
BCYAN='\033[1;36m'; BWHITE='\033[1;37m'; BMAGENTA='\033[1;35m'
BG_DARK='\033[48;5;235m'; BG_BLUE='\033[48;5;17m'
BG_GREEN='\033[48;5;22m'; BG_RED='\033[48;5;52m'

NOW=$(date '+%Y-%m-%d %H:%M:%S')
TERM_WIDTH=$(tput cols 2>/dev/null || echo 100)

# ─── HELPERS ──────────────────────────────────────────────────
bar() {
  local pct=$1 width=${2:-40} fill_char="█" empty_char="░"
  local filled=$(( pct * width / 100 ))
  local empty=$(( width - filled ))
  local color=$3
  printf "${color}"
  printf "%${filled}s" | tr ' ' "$fill_char"
  printf "${DIM}"
  printf "%${empty}s" | tr ' ' "$empty_char"
  printf "${RESET}"
}

divider() {
  local char="${1:--}" color="${2:-$DIM}"
  printf "${color}"
  printf "%${TERM_WIDTH}s\n" | tr ' ' "$char"
  printf "${RESET}"
}

center() {
  local text="$1" color="${2:-$BWHITE}"
  local clean=$(echo -e "$text" | sed 's/\x1b\[[0-9;]*m//g')
  local len=${#clean}
  local pad=$(( (TERM_WIDTH - len) / 2 ))
  printf "%${pad}s${color}${text}${RESET}\n"
}

fmt_seconds() {
  local s=$1
  local h=$(( s / 3600 )) m=$(( (s % 3600) / 60 )) sec=$(( s % 60 ))
  if [[ $h -gt 0 ]]; then printf "${h}h ${m}m"
  elif [[ $m -gt 0 ]]; then printf "${m}m ${sec}s"
  else printf "${sec}s"; fi
}

fmt_ms() {
  local ms=$1
  if [[ $ms -lt 1000 ]]; then printf "${ms}ms"
  elif [[ $ms -lt 60000 ]]; then printf "$(( ms/1000 ))s"
  else printf "$(( ms/60000 ))m $(( (ms%60000)/1000 ))s"; fi
}

# ─── HEADER ──────────────────────────────────────────────────
clear
divider "═" "$BCYAN"
center "  ⚡  SOVEREIGN DUAL RUNNER MONITOR  ⚡  " "$BCYAN"
center "$NOW" "$DIM"
divider "═" "$BCYAN"

# ─── PZO STATE ───────────────────────────────────────────────
pzo_completed=0; pzo_failed=0; pzo_total=500; pzo_crashes=0
pzo_current=""; pzo_last_two=()

if [[ -f "$PZO_STATE" ]]; then
  pzo_completed=$(python3 -c "import json; s=json.load(open('$PZO_STATE')); print(len(s.get('completed',[])))" 2>/dev/null || echo 0)
  pzo_failed=$(python3 -c "import json; s=json.load(open('$PZO_STATE')); print(len(s.get('failed',[])))" 2>/dev/null || echo 0)
  pzo_crashes=$(python3 -c "import json; s=json.load(open('$PZO_STATE')); print(s.get('crash_count',0))" 2>/dev/null || echo 0)
  pzo_current=$(python3 -c "import json; s=json.load(open('$PZO_STATE')); print(s.get('current_task','') or '')" 2>/dev/null || echo "")
fi

# Read last 2 tasks from PZO log
if ls "$PZO_LOG_DIR"/*.log 2>/dev/null | head -1 > /dev/null 2>&1; then
  latest_pzo_log=$(ls -t "$PZO_LOG_DIR"/*.log 2>/dev/null | head -1)
  if [[ -f "$latest_pzo_log" ]]; then
    mapfile -t pzo_last_two < <(grep -E "Written:|FAILED" "$latest_pzo_log" 2>/dev/null | tail -2 | sed 's/.*Written: //' | sed 's/.*FAILED.*/FAILED/' | cut -c1-60)
  fi
fi

pzo_pct=0
[[ $pzo_total -gt 0 ]] && pzo_pct=$(( pzo_completed * 100 / pzo_total ))
pzo_success_rate=100
[[ $(( pzo_completed + pzo_failed )) -gt 0 ]] && pzo_success_rate=$(( pzo_completed * 100 / (pzo_completed + pzo_failed) ))

# Estimate time remaining for PZO
pzo_elapsed=0; pzo_eta_str="calculating..."
if [[ -f "$PZO_STATE" ]]; then
  pzo_started=$(python3 -c "import json; s=json.load(open('$PZO_STATE')); print(int(s.get('started_at',0)))" 2>/dev/null || echo 0)
  if [[ $pzo_started -gt 0 && $pzo_completed -gt 0 ]]; then
    pzo_elapsed=$(( $(date +%s) - pzo_started ))
    pzo_rate_per_s=$(echo "scale=4; $pzo_completed / $pzo_elapsed" | bc 2>/dev/null || echo "0")
    pzo_remaining=$(( pzo_total - pzo_completed ))
    if [[ "$pzo_rate_per_s" != "0" && "$pzo_rate_per_s" != "" ]]; then
      pzo_eta_s=$(python3 -c "r=$pzo_rate_per_s; rem=$pzo_remaining; print(int(rem/r) if r>0 else 0)" 2>/dev/null || echo 0)
      pzo_eta_str=$(fmt_seconds $pzo_eta_s)
    fi
  fi
fi

# ─── REVOPS STATE ────────────────────────────────────────────
revops_completed=0; revops_failed=0; revops_total=2553
revops_pct=0; revops_last_two=(); revops_eta_str="calculating..."
revops_current=""; revops_avg_ms=0

# Find revops log — check common locations
for candidate in \
  "$PZO/../revops_runner/runtime/logs/runner_latest.log" \
  "$HOME/autonomous_revops_runner.log" \
  "/tmp/revops_runner.log" \
  "$PZO/../pzo_complete_automation/runtime/logs/revops_latest.log"; do
  if [[ -f "$candidate" ]]; then
    REVOPS_LOG="$candidate"
    break
  fi
done

# Also search for most recently modified log in the workspace
if [[ -z "$REVOPS_LOG" ]]; then
  REVOPS_LOG=$(find /Users/mervinlarry/workspaces/adam -name "*.log" -newer /tmp -type f 2>/dev/null | \
    xargs ls -t 2>/dev/null | head -1)
fi

if [[ -n "$REVOPS_LOG" && -f "$REVOPS_LOG" ]]; then
  revops_completed=$(grep -c "✅" "$REVOPS_LOG" 2>/dev/null || echo 0)
  revops_failed=$(grep -c "❌\|FAILED\|failed" "$REVOPS_LOG" 2>/dev/null || echo 0)
  [[ $revops_total -gt 0 ]] && revops_pct=$(( revops_completed * 100 / revops_total ))

  # Last two attempted files
  mapfile -t revops_last_two < <(grep -E "Executing|✅" "$REVOPS_LOG" 2>/dev/null | tail -4 | \
    grep -oE '[A-Za-z0-9_/.-]+\.(ts|js|sh|md)' | tail -2)

  # Current executing
  revops_current=$(grep "Executing" "$REVOPS_LOG" 2>/dev/null | tail -1 | grep -oE '[A-Z0-9_]+_T[0-9]+' || echo "")

  # Avg task time from last 10 completions
  revops_avg_ms=$(grep -oE "completed in [0-9]+ms" "$REVOPS_LOG" 2>/dev/null | tail -10 | \
    grep -oE "[0-9]+" | awk '{sum+=$1; count++} END {if(count>0) print int(sum/count); else print 0}')

  # ETA
  revops_remaining=$(( revops_total - revops_completed ))
  if [[ $revops_avg_ms -gt 0 && $revops_remaining -gt 0 ]]; then
    revops_eta_s=$(( revops_remaining * revops_avg_ms / 1000 ))
    revops_eta_str=$(fmt_seconds $revops_eta_s)
  fi
fi

revops_success_rate=100
[[ $(( revops_completed + revops_failed )) -gt 0 ]] && \
  revops_success_rate=$(( revops_completed * 100 / (revops_completed + revops_failed) ))

# ─── RENDER PZO PANEL ────────────────────────────────────────
echo ""
printf "${BG_BLUE}${BWHITE}${BOLD}  ▶  PZO BUILD — Point Zero One Digital (500 tasks)                              ${RESET}\n"
echo ""

# Progress bar
printf "  ${BCYAN}Progress   ${RESET}"
bar $pzo_pct 50 "$BCYAN"
printf "  ${BYELLOW}${BOLD}%3d%%${RESET}  ${BWHITE}%d${RESET}${DIM}/%d${RESET}\n" $pzo_pct $pzo_completed $pzo_total

echo ""

# Stats grid
printf "  ${DIM}%-18s${RESET} ${BGREEN}%-12s${RESET}  " "✅ Completed:" "$pzo_completed"
printf "  ${DIM}%-18s${RESET} ${BYELLOW}%-12s${RESET}\n" "⏱  ETA:" "$pzo_eta_str"

printf "  ${DIM}%-18s${RESET} ${BRED}%-12s${RESET}  " "❌ Failed:" "$pzo_failed"
printf "  ${DIM}%-18s${RESET} " "📈 Success Rate:"
[[ $pzo_success_rate -ge 95 ]] && printf "${BGREEN}" || printf "${BYELLOW}"
printf "%d%%${RESET}\n" $pzo_success_rate

printf "  ${DIM}%-18s${RESET} ${BYELLOW}%-12s${RESET}  " "💥 Crashes:" "$pzo_crashes"
printf "  ${DIM}%-18s${RESET} ${BCYAN}%-12s${RESET}\n" "⚡ Status:" "${pzo_current:-waiting to start}"

echo ""
printf "  ${DIM}Last attempted:${RESET}\n"
if [[ ${#pzo_last_two[@]} -gt 0 ]]; then
  for f in "${pzo_last_two[@]}"; do
    printf "    ${DIM}→${RESET} ${WHITE}%s${RESET}\n" "$f"
  done
else
  printf "    ${DIM}(no tasks executed yet — run not started)${RESET}\n"
fi

# Phase breakdown from state
if [[ -f "$PZO_STATE" ]]; then
  echo ""
  printf "  ${DIM}Phase progress:${RESET}\n"
  python3 - <<'PYEOF' 2>/dev/null
import json, os

state_file = os.environ.get('PZO_STATE', '')
taskbook = '/Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_complete_automation/master_taskbook_PZO_AUTOMATION_v1_3.ndjson'

phases = {}
completed_set = set()

if os.path.exists(state_file):
    with open(state_file) as f:
        state = json.load(f)
    completed_set = set(state.get('completed', []))

if os.path.exists(taskbook):
    with open(taskbook) as f:
        for line in f:
            line = line.strip()
            if not line: continue
            t = json.loads(line)
            ph = t['phase']
            tid = t['task_id']
            if ph not in phases:
                phases[ph] = {'total': 0, 'done': 0}
            phases[ph]['total'] += 1
            if tid in completed_set:
                phases[ph]['done'] += 1

colors = {
    'PZO_P00': '\033[0;36m', 'PZO_P01': '\033[0;32m',
    'PZO_P02': '\033[0;34m', 'PZO_P03': '\033[0;35m',
    'PZO_P04': '\033[0;33m', 'PZO_P05': '\033[0;31m',
    'PZO_P06': '\033[0;36m',
}
labels = {
    'PZO_P00_TASKBOOK_AUTOMATION': 'P00 Automation',
    'PZO_P01_ENGINE_UPGRADE': 'P01 Engine',
    'PZO_P02_PERSISTENCE_LEADERBOARD': 'P02 Persistence',
    'PZO_P03_BROWSER_UI': 'P03 Browser UI',
    'PZO_P04_MULTIPLAYER': 'P04 Multiplayer',
    'PZO_P05_ML_MONETIZATION': 'P05 ML+Money',
    'PZO_P06_LAUNCH_GTM': 'P06 Launch',
}

for ph, data in phases.items():
    pct = int(data['done'] * 100 / data['total']) if data['total'] > 0 else 0
    label = labels.get(ph, ph)[:16]
    color_key = ph[:7]
    color = colors.get(color_key, '\033[0;37m')
    bar_width = 25
    filled = int(pct * bar_width / 100)
    empty = bar_width - filled
    bar = '█' * filled + '░' * empty
    done_str = f"{data['done']}/{data['total']}"
    print(f"    {color}{label:<18}\033[0m {color}{bar}\033[0m  {pct:3d}%  \033[2m{done_str}\033[0m")
PYEOF
export PZO_STATE
fi

# ─── RENDER REVOPS PANEL ─────────────────────────────────────
echo ""
divider "-" "$DIM"
echo ""
printf "${BG_GREEN}${BWHITE}${BOLD}  ▶  REVOPS OS — Autonomous Runner (2553 tasks)                                  ${RESET}\n"
echo ""

printf "  ${BGREEN}Progress   ${RESET}"
bar $revops_pct 50 "$BGREEN"
printf "  ${BYELLOW}${BOLD}%3d%%${RESET}  ${BWHITE}%d${RESET}${DIM}/%d${RESET}\n" $revops_pct $revops_completed $revops_total

echo ""

printf "  ${DIM}%-18s${RESET} ${BGREEN}%-12s${RESET}  " "✅ Completed:" "$revops_completed"
printf "  ${DIM}%-18s${RESET} ${BYELLOW}%-12s${RESET}\n" "⏱  ETA:" "$revops_eta_str"

printf "  ${DIM}%-18s${RESET} ${BRED}%-12s${RESET}  " "❌ Failed:" "$revops_failed"
printf "  ${DIM}%-18s${RESET} " "📈 Success Rate:"
[[ $revops_success_rate -ge 95 ]] && printf "${BGREEN}" || printf "${BYELLOW}"
printf "%d%%${RESET}\n" $revops_success_rate

printf "  ${DIM}%-18s${RESET} ${BCYAN}%-12s${RESET}  " "⚡ Avg Task Time:" "$(fmt_ms ${revops_avg_ms:-0})"
printf "  ${DIM}%-18s${RESET} ${BCYAN}%-12s${RESET}\n" "🔧 Current:" "${revops_current:-detecting...}"

echo ""
printf "  ${DIM}Last attempted:${RESET}\n"
if [[ ${#revops_last_two[@]} -gt 0 ]]; then
  for f in "${revops_last_two[@]}"; do
    printf "    ${DIM}→${RESET} ${WHITE}%s${RESET}\n" "$f"
  done
elif [[ -n "$REVOPS_LOG" ]]; then
  # Fallback: show last 2 raw log lines
  mapfile -t raw_lines < <(tail -2 "$REVOPS_LOG" 2>/dev/null)
  for line in "${raw_lines[@]}"; do
    printf "    ${DIM}→${RESET} ${WHITE}%s${RESET}\n" "${line:0:80}"
  done
else
  printf "    ${DIM}(log not found — set REVOPS_LOG=<path> to enable)${RESET}\n"
fi

if [[ -n "$REVOPS_LOG" ]]; then
  printf "\n  ${DIM}Log: %s${RESET}\n" "$REVOPS_LOG"
fi

# ─── SYSTEM HEALTH ───────────────────────────────────────────
echo ""
divider "-" "$DIM"
echo ""
printf "${BWHITE}${BOLD}  SYSTEM HEALTH${RESET}\n\n"

# Ollama
if curl -sf "http://localhost:11434/api/tags" > /dev/null 2>&1; then
  printf "  ${BGREEN}●${RESET} ${DIM}Ollama:${RESET}    ${BGREEN}RUNNING${RESET}"
  model_count=$(curl -sf "http://localhost:11434/api/tags" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('models',[])))" 2>/dev/null || echo "?")
  printf "  ${DIM}(%s models loaded)${RESET}\n" "$model_count"
else
  printf "  ${BRED}●${RESET} ${DIM}Ollama:${RESET}    ${BRED}NOT RUNNING${RESET}  ${YELLOW}→ run: ollama serve${RESET}\n"
fi

# CPU
cpu_usage=$(ps aux | awk '{sum+=$3} END {printf "%.0f", sum}' 2>/dev/null || echo "?")
mem_pressure=$(memory_pressure 2>/dev/null | grep "System memory pressure" | awk '{print $NF}' || echo "unknown")
printf "  ${DIM}CPU load:${RESET}  ${BCYAN}%s%%${RESET}  ${DIM}|  Mem pressure:${RESET}  ${BCYAN}%s${RESET}\n" "$cpu_usage" "$mem_pressure"

# Revops process
if ps aux | grep "autonomous_revops_runner.ts" | grep -v grep > /dev/null 2>&1; then
  printf "  ${BGREEN}●${RESET} ${DIM}Revops runner:${RESET}  ${BGREEN}ALIVE${RESET}  (pid: $(ps aux | grep autonomous_revops | grep -v grep | awk '{print $2}' | head -1))\n"
else
  printf "  ${BRED}●${RESET} ${DIM}Revops runner:${RESET}  ${BRED}NOT RUNNING${RESET}\n"
fi

# PZO tmux
if tmux has-session -t "pzo-build" 2>/dev/null; then
  printf "  ${BGREEN}●${RESET} ${DIM}PZO tmux:${RESET}      ${BGREEN}pzo-build ALIVE${RESET}\n"
else
  printf "  ${BYELLOW}●${RESET} ${DIM}PZO tmux:${RESET}      ${BYELLOW}not started yet${RESET}\n"
fi

# ─── FOOTER ──────────────────────────────────────────────────
echo ""
divider "═" "$DIM"
printf "  ${DIM}Refreshing every 5s  |  Ctrl+C to exit  |  ${RESET}"
printf "${DIM}attach PZO: tmux attach -t pzo-build  |  "
printf "revops log: tail -f %s${RESET}\n" "${REVOPS_LOG:-'<set REVOPS_LOG=path>'}"
divider "═" "$DIM"
