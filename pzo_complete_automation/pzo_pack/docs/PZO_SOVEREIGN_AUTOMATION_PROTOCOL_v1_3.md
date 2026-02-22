# PZO SOVEREIGN AUTOMATION PROTOCOL — v1.3
## Point Zero One Digital — Fully Autonomous Build System
**Generated:** 2026-02-19  
**Tasks:** 500 (PZO_T00001 → PZO_T00500)  
**New in v1.3:** 50 tasks (PZO_T00451 → PZO_T00500)  
**Engine Status:** LIVE — 17/17 tests passing

---

## WHAT THIS IS

A fully autonomous, self-resuming build system that:
1. Reads `master_taskbook_PZO_AUTOMATION_v1_3.ndjson` (500 tasks)
2. Calls Ollama for each task to generate the correct code/doc/test
3. Writes every file to the right location in the monorepo
4. Never touches your `road-to-1200` tmux session
5. Resumes from exactly where it stopped on any crash

---

## QUICKSTART

```bash
# All files live here:
cd /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_complete_automation

# Step 1 — Copy the new files from the zip
cp scripts/pzo/pzo_taskbook_runner.sh scripts/pzo/
cp scripts/pzo/pzo_launch.sh scripts/pzo/
cp scripts/pzo/pzo_stop.sh scripts/pzo/
chmod +x scripts/pzo/pzo_*.sh

# Step 2 — Copy the new taskbook
cp master_taskbook_PZO_AUTOMATION_v1_3.ndjson .

# Step 3 — Preflight check (verifies Ollama + engine baseline)
bash scripts/pzo/pzo_taskbook_runner.sh preflight

# Step 4 — Launch (starts pzo-build tmux session alongside road-to-1200)
bash scripts/pzo/pzo_launch.sh run

# Attach to watch it run:
tmux attach -t pzo-build
```

---

## SESSION ARCHITECTURE

```
tmux sessions running simultaneously:
├── road-to-1200      ← UNTOUCHED. Never killed. Never referenced.
└── pzo-build         ← NEW. 3 windows:
    ├── runner        ← Task executor (Ollama calls, file writes)
    ├── status        ← Progress dashboard (refreshes every 30s)
    └── logs          ← Live log tail
```

---

## ENV VARIABLES

| Variable | Default | Description |
|---|---|---|
| `TASKBOOK` | `master_taskbook_PZO_AUTOMATION_v1_3.ndjson` | Path to taskbook |
| `PHASE_FILTER` | *(all)* | Run only one phase |
| `START_FROM` | *(beginning)* | Resume from specific task ID |
| `DRY_RUN` | `0` | Print tasks without executing |
| `OLLAMA_MODEL` | `llama3.1:8b` | Ollama model to use |
| `MAX_RETRIES` | `3` | Retries per task before marking failed |
| `CRASH_LOOP_LIMIT` | `5` | Stop if this many consecutive crashes |

---

## COMMANDS

```bash
# Full autonomous run (preflight + all 500 tasks)
bash scripts/pzo/pzo_launch.sh run

# Run only Phase 1 engine upgrade
PHASE_FILTER=PZO_P01_ENGINE_UPGRADE bash scripts/pzo/pzo_taskbook_runner.sh run

# Resume from a specific task
START_FROM=PZO_T00050 bash scripts/pzo/pzo_taskbook_runner.sh resume

# Dry run — print all tasks without executing
DRY_RUN=1 bash scripts/pzo/pzo_taskbook_runner.sh run

# Check progress
bash scripts/pzo/pzo_taskbook_runner.sh status

# Stop pzo-build (road-to-1200 stays alive)
bash scripts/pzo/pzo_stop.sh

# Reset a phase and re-run it
PHASE_FILTER=PZO_P02_PERSISTENCE_LEADERBOARD bash scripts/pzo/pzo_reset_phase.sh
PHASE_FILTER=PZO_P02_PERSISTENCE_LEADERBOARD bash scripts/pzo/pzo_taskbook_runner.sh run

# Retry all failed tasks
bash scripts/pzo/pzo_retry_failed.sh
```

---

## PHASE EXECUTION ORDER

| Phase | ID | Tasks | What Generates |
|---|---|---|---|
| P00 — Automation | `PZO_P00_TASKBOOK_AUTOMATION` | 39 | Runner, validator, shell adapter, preflight |
| P01 — Engine | `PZO_P01_ENGINE_UPGRADE` | 53 | PlayerState, 6-deck, macro, wipe, moment-forge |
| P02 — Persistence | `PZO_P02_PERSISTENCE_LEADERBOARD` | 52 | SQLite, proof hash, REST API, leaderboard |
| P03 — Browser UI | `PZO_P03_BROWSER_UI` | 78 | React app, Vite, Tailwind, game board, cards |
| P04 — Multiplayer | `PZO_P04_MULTIPLAYER` | 62 | WebSocket, rooms, daily gauntlet, co-op contracts |
| P05 — ML + Money | `PZO_P05_ML_MONETIZATION` | 207 | All 150 ML models, GHL webhooks, paywall |
| P06 — Launch | `PZO_P06_LAUNCH_GTM` | 9 | Launch checklist, smoke tests, investor demo |

---

## STATE FILE

Progress is stored at:
```
runtime/pzo_taskbook_state.json
```

Structure:
```json
{
  "version": "1.3",
  "completed": ["PZO_T00001", "PZO_T00002", ...],
  "failed": [{"task_id": "PZO_T00050", "reason": "ollama_timeout", "at": 1234567890}],
  "crash_count": 0,
  "current_task": null
}
```

**To reset and start over:**
```bash
rm runtime/pzo_taskbook_state.json
bash scripts/pzo/pzo_taskbook_runner.sh run
```

**To reset only crash counter:**
```bash
bash scripts/pzo/pzo_taskbook_runner.sh reset-crashes
```

---

## COEXISTENCE WITH road-to-1200

The runner has hard-coded safety checks:
1. On startup: detects `road-to-1200` and logs "will not touch it"
2. The new session is named `pzo-build` — completely separate namespace
3. `pzo_stop.sh` only kills `pzo-build`, then verifies `road-to-1200` is still alive
4. Ollama is shared — both sessions call the same Ollama instance
5. If Ollama is under load from road-to-1200, tasks will slow but not fail

**Ollama resource tip:** If both are running simultaneously and Ollama is slow, set:
```bash
OLLAMA_MODEL=llama3.2:1b  # Faster, smaller model for PZO tasks
```

---

## WHAT v1.3 ADDS (T00451–T00500)

| Range | What |
|---|---|
| T00451–T00463 | The automation system itself (runner, launcher, stop, status, merge tools) |
| T00464–T00470 | Phase 1 core files (PlayerState, 6-deck, macro, wipe, moment-forge, turn engine) |
| T00471–T00475 | Phase 2 core files (SQLite, proof hash, REST API) |
| T00476–T00482 | Phase 3 core files (React app, game board, card hand, bankruptcy screen, proof card) |
| T00483–T00486 | Phase 4 core files (WebSocket rooms, action validator, daily gauntlet cron) |
| T00487–T00495 | Phase 5 ML base + M03a/M04a/M09a + GHL monetization |
| T00496–T00500 | Launch checklist, smoke test, investor demo, master pipeline |

---

## TROUBLESHOOTING

**Ollama not reachable:**
```bash
ollama serve  # start Ollama
ollama pull llama3.1:8b  # pull model if needed
```

**Too many crashes:**
```bash
bash scripts/pzo/pzo_taskbook_runner.sh reset-crashes
bash scripts/pzo/pzo_taskbook_runner.sh resume
```

**TypeScript errors after generation:**
```bash
cd pzo_engine && npx tsc --noEmit  # see what's broken
bash scripts/pzo/pzo_validate_outputs.sh  # validate all generated files
```

**Run a single task manually:**
```bash
START_FROM=PZO_T00464 PHASE_FILTER=PZO_P01_ENGINE_UPGRADE bash scripts/pzo/pzo_taskbook_runner.sh run
# (it will stop after Phase 1 tasks complete)
```
