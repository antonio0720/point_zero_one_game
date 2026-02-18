#!/usr/bin/env python3
"""
COMPLETE Point Zero One Taskbook Generator
Generates ALL tasks for ALL 62 phases with proper file paths
"""
import json

# Phase definitions from roadmap
PHASES = {
    "P00_KERNEL": {
        "name": "Governance kernel + CECL_v1",
        "tasks": 30,
        "dirs": ["backend/kernel", "shared/contracts/kernel"],
        "types": ["action ledger", "circuit breaker", "checkpoint", "crash-loop recovery", "mode state machine"]
    },
    "P01_MONOREPO": {
        "name": "Monorepo + source-of-truth trees",
        "tasks": 25,
        "dirs": ["scripts", "docs/architecture"],
        "types": ["structure validation", "dependency graph", "build contracts"]
    },
    "P02_DEV_SUBSTRATE": {
        "name": "Local dev substrate",
        "tasks": 20,
        "dirs": ["docker", "scripts/dev"],
        "types": ["docker compose", "one-command stack", "local services"]
    },
    "P03_CONTRACTS": {
        "name": "Contracts first",
        "tasks": 40,
        "dirs": ["shared/contracts", "shared/contracts/ids", "shared/contracts/events"],
        "types": ["IDs", "schemas", "events", "versioning", "migrations"]
    },
    "P04_PERSISTENCE": {
        "name": "Persistence layer",
        "tasks": 45,
        "dirs": ["backend/persistence", "backend/migrations"],
        "types": ["postgres", "migrations", "outbox pattern", "event store", "query builders"]
    },
    "P05_CORE_SERVICES": {
        "name": "Core service skeletons",
        "tasks": 50,
        "dirs": ["backend/api-gateway", "backend/identity", "backend/policy", "backend/auth"],
        "types": ["API gateway", "identity service", "policy engine", "auth service"]
    },
    "P05A_COMMERCE": {
        "name": "Commerce + entitlements",
        "tasks": 40,
        "dirs": ["backend/commerce", "backend/entitlements"],
        "types": ["payments", "purchases", "receipts", "refunds", "entitlement ledger"]
    },
    "P05B_IDENTITY_LIFECYCLE": {
        "name": "Identity lifecycle + recovery",
        "tasks": 35,
        "dirs": ["backend/identity/recovery", "backend/identity/device-linking"],
        "types": ["account recovery", "device linking", "multi-device sync", "session management"]
    },
    "P05C_ABUSE_MGMT": {
        "name": "Abuse + ban management",
        "tasks": 35,
        "dirs": ["backend/moderation", "backend/moderation/appeals"],
        "types": ["ban state machine", "appeals", "escalation", "moderation queue"]
    },
    "P05D_PARENTAL": {
        "name": "Parental controls + consent",
        "tasks": 30,
        "dirs": ["backend/parental", "frontend/web/components/parental"],
        "types": ["age gating", "COPPA compliance", "feature restrictions", "parental dashboard"]
    },
    "P06_TELEMETRY": {
        "name": "Telemetry spine",
        "tasks": 40,
        "dirs": ["backend/telemetry", "backend/analytics"],
        "types": ["event taxonomy", "analytics collector", "replay tooling", "metrics pipeline"]
    },
    "P07_GAME_ENGINE": {
        "name": "Deterministic run engine",
        "tasks": 60,
        "dirs": ["backend/game-engine", "backend/game-engine/wasm"],
        "types": ["core rules", "deterministic execution", "WASM compilation", "tick engine"]
    },
    "P08_VERIFIER": {
        "name": "Verifier + proof cards",
        "tasks": 45,
        "dirs": ["backend/verifier", "backend/proof-cards"],
        "types": ["cryptographic receipts", "fraud detection", "proof generation", "verification API"]
    },
    "P09_DECK_REACTOR": {
        "name": "Deck reactor",
        "tasks": 50,
        "dirs": ["backend/deck-reactor", "backend/deck-reactor/validation"],
        "types": ["mechanics ingestion", "validation", "canary rollouts", "ML-driven balancing"]
    },
    "P10_CLIENT_FOUNDATIONS": {
        "name": "Client foundations",
        "tasks": 55,
        "dirs": ["frontend/web", "frontend/admin", "frontend/creator", "shared/api-clients"],
        "types": ["web shell", "admin shell", "creator shell", "type-safe APIs", "error taxonomy"]
    },
    "P11_CONTESTANT_CORE": {
        "name": "Contestant core",
        "tasks": 45,
        "dirs": ["backend/contestant", "backend/contestant/inventory", "backend/contestant/progression"],
        "types": ["profiles", "inventory", "progression", "trust scoring", "device trust"]
    },
    "P12_ECONOMY": {
        "name": "Economy engine",
        "tasks": 50,
        "dirs": ["backend/economy", "backend/economy/currencies", "backend/economy/rewards"],
        "types": ["currencies", "rewards", "sink/source balancing", "fraud detection", "transaction ledger"]
    },
    "P13_ACHIEVEMENTS": {
        "name": "Achievements + quests + battle pass",
        "tasks": 50,
        "dirs": ["backend/achievements", "backend/quests", "backend/battle-pass"],
        "types": ["proof-based progression", "quest scheduling", "battle pass", "seasonal rewards"]
    },
    "P14_RUNS_LIFECYCLE": {
        "name": "Runs lifecycle",
        "tasks": 55,
        "dirs": ["backend/runs", "backend/runs/settlement"],
        "types": ["create", "execute", "finalize", "share", "settlement pipeline"]
    },
    "P15_MATCHMAKING": {
        "name": "Matchmaking + sessions",
        "tasks": 50,
        "dirs": ["backend/matchmaking", "backend/sessions"],
        "types": ["co-op tables", "PvP ghosts", "realtime tick stream", "session management"]
    },
    "P15A_SIMULATION": {
        "name": "Simulation + fuzz harness",
        "tasks": 45,
        "dirs": ["backend/simulation", "backend/simulation/fuzz"],
        "types": ["Monte Carlo", "action fuzzing", "fairness validation", "balance testing"]
    },
    "P15B_LOAD_TESTING": {
        "name": "Load + stress + chaos testing",
        "tasks": 60,
        "dirs": ["testing/load", "testing/chaos"],
        "types": ["10K runs/sec", "service kills", "spike tests", "chaos engineering"]
    },
    "P16_MACRO_SYSTEMS": {
        "name": "Macro systems",
        "tasks": 55,
        "dirs": ["backend/macro", "backend/macro/shocks"],
        "types": ["inflation", "credit tightness", "shocks", "regime transitions"]
    },
    "P17_DECK_SYSTEMS": {
        "name": "Deck systems",
        "tasks": 60,
        "dirs": ["backend/decks", "backend/decks/opportunity", "backend/decks/fubar"],
        "types": ["6 decks", "draw engine", "card rendering", "deck balance"]
    },
    "P18_COOP_CONTRACTS": {
        "name": "Co-op contracts",
        "tasks": 50,
        "dirs": ["backend/coop", "backend/coop/contracts"],
        "types": ["clauses", "voting", "escrow", "enforcement"]
    },
    "P19_ASSET_SYSTEMS": {
        "name": "Asset systems",
        "tasks": 55,
        "dirs": ["backend/assets", "backend/assets/leverage", "backend/assets/liquidity"],
        "types": ["leverage", "liquidity", "synergies", "hedge pairs", "portfolio heat"]
    },
    "P20_PROGRESSION": {
        "name": "Achievements + progression",
        "tasks": 50,
        "dirs": ["backend/progression", "backend/progression/badges"],
        "types": ["badges", "relics", "titles", "proof tiers", "crafting"]
    },
    "P21_ONBOARDING": {
        "name": "Onboarding + training",
        "tasks": 45,
        "dirs": ["frontend/web/components/onboarding", "backend/training"],
        "types": ["boot run", "tutorials", "practice sandbox", "progressive disclosure"]
    },
    "P22_VERIFICATION": {
        "name": "Verification + integrity",
        "tasks": 50,
        "dirs": ["backend/verification", "backend/integrity"],
        "types": ["deterministic replay", "signed actions", "anti-cheat", "integrity checks"]
    },
    "P23_ADVANCED_COOP": {
        "name": "Advanced co-op",
        "tasks": 45,
        "dirs": ["backend/coop/advanced", "backend/coop/arbitration"],
        "types": ["syndicate deals", "escrow milestones", "arbitration", "reputation stakes"]
    },
    "P24_ADVANCED_GAMEPLAY": {
        "name": "Advanced gameplay",
        "tasks": 50,
        "dirs": ["backend/gameplay/advanced"],
        "types": ["doctrine contracts", "rebalancing pulse", "stress tests", "synergy overload"]
    },
    "P25_LEADERBOARDS": {
        "name": "Leaderboards + social",
        "tasks": 55,
        "dirs": ["backend/leaderboards", "backend/social"],
        "types": ["proof-weighted", "badges", "cosmetics", "teams", "mentor queue"]
    },
    "P26_ML_INFRA": {
        "name": "ML infrastructure",
        "tasks": 60,
        "dirs": ["backend/ml/infrastructure", "backend/ml/feature-store"],
        "types": ["feature store", "training orchestration", "model registry", "eval harness"]
    },
    "P26A_ML_GOVERNANCE": {
        "name": "ML data governance",
        "tasks": 40,
        "dirs": ["backend/ml/governance"],
        "types": ["retention", "deletion", "consent", "allowlists", "audit logs"]
    },
    "P27_ML_CORE": {
        "name": "ML core models",
        "tasks": 65,
        "dirs": ["backend/ml/models", "backend/ml/models/deck-reactor"],
        "types": ["deck reactor RL", "collapse predictor", "affordability scorer", "fairness auditor"]
    },
    "P28_ML_SAFETY": {
        "name": "ML safety + integrity",
        "tasks": 55,
        "dirs": ["backend/ml/safety"],
        "types": ["anomaly detection", "fraud detection", "trust scoring", "quarantine"]
    },
    "P29_ML_BEHAVIORAL": {
        "name": "ML behavioral + personalization",
        "tasks": 60,
        "dirs": ["backend/ml/behavioral"],
        "types": ["choice drill generator", "skill rating", "playstyle clustering"]
    },
    "P30_ML_BATCH1": {
        "name": "ML companions batch 1",
        "tasks": 55,
        "dirs": ["backend/ml/companions/batch1"],
        "types": ["emergency liquidity", "misclick guard", "rivalry ledger"]
    },
    "P31_ML_BATCH2": {
        "name": "ML companions batch 2",
        "tasks": 55,
        "dirs": ["backend/ml/companions/batch2"],
        "types": ["hardcore integrity", "faction sponsorship", "NPC counterparties"]
    },
    "P32_ML_BATCH3": {
        "name": "ML companions batch 3",
        "tasks": 55,
        "dirs": ["backend/ml/companions/batch3"],
        "types": ["spectator theater", "litigation risk", "counterparty freeze"]
    },
    "P32A_ML_VERSIONING": {
        "name": "ML dataset versioning + lineage",
        "tasks": 35,
        "dirs": ["backend/ml/versioning"],
        "types": ["provenance", "reproducibility", "audit trail"]
    },
    "P33_ML_OBSERVABILITY": {
        "name": "ML observability + continuous learning",
        "tasks": 50,
        "dirs": ["backend/ml/observability"],
        "types": ["drift detection", "A/B auto-promotion", "explainability"]
    },
    "P33A_ML_ROLLBACK": {
        "name": "ML rollback + kill switch",
        "tasks": 35,
        "dirs": ["backend/ml/rollback"],
        "types": ["instant disable", "auto-rollback", "fallback strategies"]
    },
    "P34_WEB_CLIENT": {
        "name": "Web client complete",
        "tasks": 80,
        "dirs": ["frontend/web/components", "frontend/web/pages", "frontend/web/lib"],
        "types": ["PWA", "offline mode", "share integration", "WASM engine"]
    },
    "P35_MOBILE_CLIENT": {
        "name": "Mobile client complete",
        "tasks": 85,
        "dirs": ["frontend/mobile/components", "frontend/mobile/screens", "frontend/mobile/lib"],
        "types": ["iOS", "Android", "push notifications", "biometrics", "deep links"]
    },
    "P36_DESKTOP_CLIENT": {
        "name": "Desktop client complete",
        "tasks": 70,
        "dirs": ["frontend/desktop/components", "frontend/desktop/lib"],
        "types": ["OBS integration", "replay viewer", "clip studio"]
    },
    "P37_ADMIN_CONSOLE": {
        "name": "Admin console complete",
        "tasks": 65,
        "dirs": ["frontend/admin/components", "frontend/admin/dashboards"],
        "types": ["moderation", "economy", "content management", "player support"]
    },
    "P38_CREATOR_STUDIO": {
        "name": "Creator studio complete",
        "tasks": 70,
        "dirs": ["frontend/creator/components", "frontend/creator/tools"],
        "types": ["scenario builder", "validation pipeline", "publishing workflow"]
    },
    "P39_MULTI_CLIENT": {
        "name": "Multi-client sync + handoff",
        "tasks": 50,
        "dirs": ["backend/sync", "backend/handoff"],
        "types": ["device linking", "session handoff", "cloud saves"]
    },
    "P39A_CONTENT_TOOLS": {
        "name": "Internal content authoring tools",
        "tasks": 45,
        "dirs": ["internal/tools/mechanics-editor", "internal/tools/deck-builder"],
        "types": ["mechanics editor", "deck builder", "batch operations"]
    },
    "P39B_RELEASE_CONSOLE": {
        "name": "Release + rollback console",
        "tasks": 40,
        "dirs": ["internal/release-console"],
        "types": ["approval workflows", "canary management", "rollback"]
    },
    "P40_LIVEOPS": {
        "name": "LiveOps control plane",
        "tasks": 60,
        "dirs": ["backend/liveops", "backend/liveops/seasons"],
        "types": ["feature flags", "season scheduler", "experiment DSL", "rollout dashboards"]
    },
    "P41_GROWTH": {
        "name": "Growth automation",
        "tasks": 55,
        "dirs": ["backend/growth", "backend/growth/referrals"],
        "types": ["referrals", "challenges", "share loops", "viral mechanics", "abuse controls"]
    },
    "P42_CUSTOMER_OPS": {
        "name": "Customer ops automation",
        "tasks": 50,
        "dirs": ["backend/customer-ops", "backend/customer-ops/disputes"],
        "types": ["dispute workflows", "proof-based adjudication", "refund rules"]
    },
    "P43_ANALYTICS": {
        "name": "Analytics + BI",
        "tasks": 55,
        "dirs": ["backend/analytics", "backend/analytics/warehouse"],
        "types": ["data warehouse", "metrics models", "dashboards", "cohort analysis"]
    },
    "P44_OBSERVABILITY": {
        "name": "Observability + SRE",
        "tasks": 60,
        "dirs": ["infrastructure/observability", "infrastructure/sre"],
        "types": ["tracing", "log aggregation", "alert rules", "incident playbooks"]
    },
    "P45_CI_CD": {
        "name": "CI/CD",
        "tasks": 55,
        "dirs": ["infrastructure/ci-cd", "infrastructure/pipelines"],
        "types": ["build pipelines", "artifact signing", "environment promotion", "release channels"]
    },
    "P46_SECURITY": {
        "name": "Security hardening",
        "tasks": 60,
        "dirs": ["infrastructure/security"],
        "types": ["SAST", "dependency scanning", "SBOM generation", "threat modeling"]
    },
    "P47_DATA_RETENTION": {
        "name": "Data retention + deletion automation",
        "tasks": 45,
        "dirs": ["backend/data-retention"],
        "types": ["GDPR right-to-delete", "compliance audits", "automated deletion"]
    },
    "P47A_INCIDENT_RESPONSE": {
        "name": "Security incident response",
        "tasks": 40,
        "dirs": ["infrastructure/incident-response"],
        "types": ["automated playbooks", "forensics", "postmortems"]
    },
    "P47B_TAX_COMPLIANCE": {
        "name": "Tax + compliance automation",
        "tasks": 45,
        "dirs": ["backend/tax-compliance"],
        "types": ["VAT", "sales tax", "receipts", "regulatory filings"]
    },
    "P47C_PARENTAL_FULL": {
        "name": "Parental controls + age gating",
        "tasks": 40,
        "dirs": ["backend/parental/full", "frontend/web/components/parental"],
        "types": ["COPPA compliance", "feature restrictions", "parental dashboard"]
    }
}

def generate_task(task_id, phase_key, task_type, module_name, file_path):
    """Generate a single task with proper file path"""
    phase_info = PHASES[phase_key]
    
    return {
        "task_id": task_id,
        "type": task_type,
        "phase": phase_key,
        "input": f"{file_path}: {phase_info['name']} - {module_name}",
        "retry_count": 0
    }

def generate_all_tasks():
    """Generate complete taskbook for all phases"""
    tasks = []
    task_counter = 1
    
    for phase_key in sorted(PHASES.keys()):
        phase = PHASES[phase_key]
        num_tasks = phase["tasks"]
        dirs = phase["dirs"]
        types = phase["types"]
        
        for i in range(num_tasks):
            task_id = f"T{task_counter:05d}"
            
            # Determine task type
            if i % 5 == 0:
                task_type = "create_module"
            elif i % 5 == 1:
                task_type = "create_contract"
            elif i % 5 == 2:
                task_type = "implement_feature"
            elif i % 5 == 3:
                task_type = "create_test"
            else:
                task_type = "create_docs"
            
            # Choose directory
            dir_idx = i % len(dirs)
            directory = dirs[dir_idx]
            
            # Choose module type
            type_idx = i % len(types)
            module_type = types[type_idx]
            
            # Generate module name
            module_name = f"{module_type.replace(' ', '-')}-{(i // len(types)) + 1}"
            
            # Generate file path based on task type
            if task_type == "create_test":
                file_path = f"{directory}/__tests__/{module_name}.test.ts"
            elif task_type == "create_docs":
                file_path = f"docs/{phase_key.lower()}/{module_name}.md"
            elif "frontend" in directory:
                file_path = f"{directory}/{module_name}.tsx"
            elif "backend/ml" in directory:
                file_path = f"{directory}/{module_name}.py"
            else:
                file_path = f"{directory}/{module_name}.ts"
            
            task = generate_task(task_id, phase_key, task_type, module_name, file_path)
            tasks.append(task)
            
            task_counter += 1
    
    return tasks

def main():
    tasks = generate_all_tasks()
    
    output_file = "master_taskbook_COMPLETE.ndjson"
    with open(output_file, 'w') as f:
        for task in tasks:
            f.write(json.dumps(task) + '\n')
    
    print(f"Generated {len(tasks)} tasks")
    print(f"Output: {output_file}")
    print(f"\nPhases: {len(PHASES)}")
    print(f"First task: {tasks[0]['task_id']} - {tasks[0]['input']}")
    print(f"Last task: {tasks[-1]['task_id']} - {tasks[-1]['input']}")
    
    # Verify all tasks have file paths
    with_paths = sum(1 for t in tasks if any(x in t['input'] for x in ['backend/', 'frontend/', 'shared/', 'docs/', 'infrastructure/', 'internal/', 'testing/']))
    print(f"\nTasks with file paths: {with_paths}/{len(tasks)} ({with_paths*100//len(tasks)}%)")

if __name__ == "__main__":
    main()
