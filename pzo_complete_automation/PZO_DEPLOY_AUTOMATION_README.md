# PZO DEPLOYMENT AUTOMATION — README
## 1325 Tasks · 52 Phases · Session: `pzo-deploy`

---

## QUICK START

```bash
# 1. Verify setup + launch
bash /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_complete_automation/QUICK_START_DEPLOY.sh

# 2. Attach to runner
tmux attach -t pzo-deploy

# 3. Monitor (new terminal, runs standalone)
bash .../pzo_complete_automation/scripts/pzo/pzo_deploy_watch.sh
```

---

## SESSION ARCHITECTURE

| Session | What | Touched? |
|---|---|---|
| `road-to-1200` | RevOps automation (NO tmux) | ❌ NEVER |
| `pzo-build` | Previous PZO taskbook runner | ❌ NEVER |
| `pzo-deploy` | This deployment runner | ✅ NEW |

---

## TMUX WINDOWS (pzo-deploy)

| Window | Purpose |
|---|---|
| `runner` | Main execution log — Ollama task build |
| `monitor` | Live dashboard (5s refresh) |
| `logs` | Raw log tail |
| `ops` | Status + quick command reference |

---

## TASKBOOK

```
master_taskbook_PZO_DEPLOYMENT_HOW_TO_DEPLOY_v1_0.ndjson
1325 tasks · 52 phases
```

State: `runtime/pzo_deploy_state.json`
Logs:  `runtime/logs/deploy/`
Artifacts: `runtime/artifacts/`

---

## COMMANDS

```bash
SCRIPTS=/Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_complete_automation/scripts/pzo

# Launch (full run)
bash $SCRIPTS/pzo_deploy_launch.sh run

# Resume from where it stopped
bash $SCRIPTS/pzo_deploy_launch.sh resume

# Status check (no tmux needed)
bash $SCRIPTS/pzo_deploy_runner.sh status

# Stop (only pzo-deploy — never others)
bash $SCRIPTS/pzo_deploy_stop.sh

# Reset crashes + retry failed tasks
bash $SCRIPTS/pzo_deploy_runner.sh reset-crashes

# Run single phase only
PHASE_FILTER=PZO_INFRA_FOUNDATION_V1 bash $SCRIPTS/pzo_deploy_runner.sh run

# Resume from specific task
START_FROM=PZO_GAME_T001 bash $SCRIPTS/pzo_deploy_runner.sh resume

# Dry run (no Ollama calls — validates taskbook only)
DRY_RUN=1 bash $SCRIPTS/pzo_deploy_runner.sh run

# Override model
OLLAMA_MODEL=qwen2.5:14b bash $SCRIPTS/pzo_deploy_runner.sh resume

# Crash loop limit (default 50)
CRASH_LOOP_LIMIT=100 bash $SCRIPTS/pzo_deploy_runner.sh resume
```

---

## MODEL ROUTING

Tasks auto-route to progressively larger models on retry:

| Retry | Model |
|---|---|
| 0 (first) | `mistral:7b` |
| 1 | `llama3.1:8b` |
| 2 | `qwen2.5:7b` |
| 3 | `llama3.1:8b` |
| 4 | `qwen2.5:14b` |
| 5 | `qwen2.5:32b` |

---

## OLLAMA COEXISTENCE

The runner uses a **2–8s random jitter** per task to avoid hammering Ollama when `road-to-1200` or `pzo-build` are also calling it. The crash loop limit automatically halts if >50 consecutive failures occur, protecting Ollama from overload.

---

## PHASE ORDER (execution sequence)

```
01  PZO_INFRA_FOUNDATION_V1
02  PZO_AUTH_IDENTITY_V1
03  PZO_GAME_CORE_ENGINE_V1
04  PZO_CONTENT_OPS_V1
05  PZO_BALANCE_TOOLING_V1
06  PZO_SHARE_ENGINE_V1
07  PZO_AFTER_ACTION_PLAN_V1
08  PZO_TRUST_PROOF_RUN_EXPLORER
09  PZO_VERIFIED_BR_BUILD_V1
10  PZO_PVP_TWO_TIER_LADDER_TRUST_FIREWALL
11  PZO_LADDER_BUILD_V1
12  PZO_SEASON0_FOUNDING_ERA_WAITLIST_ENGINE
13  PZO_SEASON0_BUILD_V1
14  PZO_CREATOR_ECONOMY_GOVERNED_PIPELINE_V1
15  PZO_CREATOR_ECONOMY_BUILD_V1
16  HOS_P00_LANDING → HOS_P07_V2_STUBS
17  PZO_MONETIZATION_ENGINE_V1
18  PZO_MONETIZATION_GOVERNANCE_OS_AND_LIVEOPS_EXCHANGE_LOOP_V1
19  PZO_REMOTE_CONFIG_MONETIZATION_GOVERNANCE_V1
20  PZO_TELEMETRY_LIVEOPS_LOOP_V1
21  PZO_LIVEOPS_WEEKLY_MACHINE_V1
22  PZO_NOTIFICATIONS_ENGAGEMENT_V1
23  PZO_ONBOARDING_THREE_RUN_ARC_V1
24  PZO_RELEASE_STAGES_V1
25  PZO_B2B_CORPORATE_WELLNESS_V1
26  PZO_CURRICULUM_SPINE_LICENSING_V1
27  PZO_LICENSING_READY_CURRICULUM_SPINE_V1
28  PZO_PARTNER_DISTRIBUTION_CHANNELS_V1
29  PZO_PHYSICAL_GAME_INTEGRATION_V1
30  PZO_LAUNCH_ARCHITECTURE_V1
31  PZO_DEPLOYMENT_HOW_TO_DEPLOY_PLAYBOOK_V1
32  PZO_LOSS_IS_CONTENT_SYSTEM_V1
33  PZO_PUBLIC_INTEGRITY_PAGE_V1
34  PZO_PUBLIC_INTEGRITY_PAGE_TRUST_MARKETING_V1
35  PZO_INTEGRITY_MARKETING_V1
36  PZO_WEAPON1_BIOMETRIC_V1
37  PZO_WEAPON2_CARD_FORGE_V1
38  PZO_WEAPON3_GENERATIONAL_V1
39  PZO_WEAPON4_MACRO_SHOCK_V1
40  PZO_WEAPON5_FORENSIC_AUTOPSY_V1
41  PZO_WEAPON7_SENTIMENT_V1
42  PZO_DATA_ML_INFRASTRUCTURE_V1
43  PZO_MOBILE_APPS_V1
44  PZO_SECURITY_COMPLIANCE_V1
45  PZO_HOST_OS_KIT_BUILD_V1
46  PZO_QUALITY_GATES_V1
```

---

## FILES

```
pzo_complete_automation/
├── QUICK_START_DEPLOY.sh              ← START HERE
├── master_taskbook_PZO_DEPLOYMENT_HOW_TO_DEPLOY_v1_0.ndjson
├── scripts/
│   └── pzo/
│       ├── pzo_deploy_runner.sh       ← main execution engine
│       ├── pzo_deploy_launch.sh       ← tmux session launcher
│       ├── pzo_deploy_stop.sh         ← safe stop (pzo-deploy only)
│       ├── pzo_deploy_monitor.py      ← live dashboard
│       └── pzo_deploy_watch.sh        ← monitor launcher (watch -n 5)
└── runtime/
    ├── pzo_deploy_state.json          ← auto-created on first run
    ├── logs/deploy/                   ← runner logs
    ├── reports/                       ← preflight + run reports
    ├── artifacts/                     ← raw Ollama outputs per task
    └── tmp/                           ← temp Python call scripts
```
