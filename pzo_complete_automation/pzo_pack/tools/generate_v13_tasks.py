#!/usr/bin/env python3
"""Generate PZO Taskbook v1.3 — new tasks T00451-T00500"""
import json

tasks = [
  # ── AUTOMATION ORCHESTRATION (P00) ──────────────────────────
  {"task_id":"PZO_T00451","type":"create_module","phase":"PZO_P00_TASKBOOK_AUTOMATION",
   "input":"scripts/pzo/pzo_taskbook_runner.sh: Autonomous NDJSON task executor — reads master_taskbook, calls Ollama per task, writes files, crash-loop guard, full resume, never touches road-to-1200 session","retry_count":0},
  {"task_id":"PZO_T00452","type":"create_module","phase":"PZO_P00_TASKBOOK_AUTOMATION",
   "input":"scripts/pzo/pzo_launch.sh: tmux session launcher (pzo-build) — 3 windows (runner/status/logs), coexists with road-to-1200, DRY_RUN + PHASE_FILTER + START_FROM env support","retry_count":0},
  {"task_id":"PZO_T00453","type":"create_module","phase":"PZO_P00_TASKBOOK_AUTOMATION",
   "input":"scripts/pzo/pzo_stop.sh: Safe session stopper — kills pzo-build only, verifies road-to-1200 is still running after stop, prints session list","retry_count":0},
  {"task_id":"PZO_T00454","type":"create_module","phase":"PZO_P00_TASKBOOK_AUTOMATION",
   "input":"scripts/pzo/pzo_status.sh: Progress dashboard — reads state JSON, prints phase-by-phase completion %, failed tasks, crash count, estimated remaining time","retry_count":0},
  {"task_id":"PZO_T00455","type":"create_docs","phase":"PZO_P00_TASKBOOK_AUTOMATION",
   "input":"docs/pzo/taskbook/PZO_SOVEREIGN_AUTOMATION_PROTOCOL_v1_3.md: Master README for the full automation system — quickstart, session management, env vars, phase commands, troubleshooting","retry_count":0},
  {"task_id":"PZO_T00456","type":"create_module","phase":"PZO_P00_TASKBOOK_AUTOMATION",
   "input":"scripts/pzo/pzo_reset_phase.sh: Reset state for a single phase — removes completed/failed for that phase from state JSON, allows re-run of specific phase without full reset","retry_count":0},
  {"task_id":"PZO_T00457","type":"create_module","phase":"PZO_P00_TASKBOOK_AUTOMATION",
   "input":"scripts/pzo/pzo_retry_failed.sh: Re-queue all failed tasks — resets retry_count, removes from failed list in state, appends to run queue, with optional PHASE_FILTER","retry_count":0},
  {"task_id":"PZO_T00458","type":"create_module","phase":"PZO_P00_TASKBOOK_AUTOMATION",
   "input":"scripts/pzo/pzo_validate_outputs.sh: Post-run output validator — tsc --noEmit on all generated .ts files, bash -n on all .sh files, md lint on all .md files, prints pass/fail per task","retry_count":0},
  {"task_id":"PZO_T00459","type":"create_test","phase":"PZO_P00_TASKBOOK_AUTOMATION",
   "input":"tools/pzo_taskbook/taskbook_runner_v13.test.ts: Tests for runner (state init, completed skip, crash loop trigger at 5, phase filter, start-from gate, dry-run produces no files)","retry_count":0},
  {"task_id":"PZO_T00460","type":"create_docs","phase":"PZO_P00_TASKBOOK_AUTOMATION",
   "input":"docs/pzo/taskbook/SESSION_COEXISTENCE.md: Proof that pzo-build and road-to-1200 can run simultaneously — tmux session isolation, shared Ollama resource management, CPU/RAM budgets","retry_count":0},

  # ── TASKBOOK v1.3 ITSELF ─────────────────────────────────────
  {"task_id":"PZO_T00461","type":"create_docs","phase":"PZO_P00_TASKBOOK_AUTOMATION",
   "input":"docs/pzo/taskbook/master_taskbook_PZO_AUTOMATION_v1_3_README.md: Changelog v1.2→v1.3 — new tasks added (T00451-T00500), schema changes, how to merge with existing state file","retry_count":0},
  {"task_id":"PZO_T00462","type":"create_module","phase":"PZO_P00_TASKBOOK_AUTOMATION",
   "input":"tools/pzo_taskbook/taskbook_merge.py: Merge two taskbook NDJSON files — dedup by task_id, preserve ordering, emit merged file + diff report","retry_count":0},
  {"task_id":"PZO_T00463","type":"create_module","phase":"PZO_P00_TASKBOOK_AUTOMATION",
   "input":"tools/pzo_taskbook/taskbook_stats.py: Taskbook statistics — tasks by phase/type, estimated time to complete at N tasks/hour, completion % per phase, blocked task detection","retry_count":0},

  # ── PHASE 1 ADDITIONS ─────────────────────────────────────────
  {"task_id":"PZO_T00464","type":"create_module","phase":"PZO_P01_ENGINE_UPGRADE",
   "input":"pzo_engine/src/engine/player-state.ts: Full PlayerState schema (cash/assetsBlgDeal/assetsIpa/monthlyIncome/monthlyDebtService/netCashflow/downpayCredit/debtServiceCredit/activeShields/leverageBlocks/turnsToSkip/consecutivePasses/inflation/creditTightness/phase) + BigDealAsset + IPAAsset + validation","retry_count":0},
  {"task_id":"PZO_T00465","type":"create_module","phase":"PZO_P01_ENGINE_UPGRADE",
   "input":"pzo_engine/src/engine/six-deck.ts: All 6 PZO decks (OPPORTUNITY/IPA/FUBAR/MISSED_OPPORTUNITY/PRIVILEGED/SO) + DeckReactor (draw-mix logic: creditTightness modulates FUBAR rate, consecutivePasses triggers MISSED_OPPORTUNITY, every 4th turn draws IPA)","retry_count":0},
  {"task_id":"PZO_T00466","type":"create_module","phase":"PZO_P01_ENGINE_UPGRADE",
   "input":"pzo_engine/src/engine/macro-engine.ts: MacroEngine — inflation 1-5, creditTightness 1-5, phase (EXPANSION/PEAK/CONTRACTION/TROUGH), end-of-rotation cash decay calculation, erosion meter value","retry_count":0},
  {"task_id":"PZO_T00467","type":"create_module","phase":"PZO_P01_ENGINE_UPGRADE",
   "input":"pzo_engine/src/engine/wipe-checker.ts: SolvencyEngine — check cash<0 AND netWorth<-100000, forced sale at 70% cost, shortfall from cash, bankruptcy event emit with forensic fields (cause/amount/tick/clip_ready:true)","retry_count":0},
  {"task_id":"PZO_T00468","type":"create_module","phase":"PZO_P01_ENGINE_UPGRADE",
   "input":"pzo_engine/src/engine/moment-forge.ts: MomentForge — guarantees exactly 3 share moments per run: FUBAR_KILLED_ME (shield failed + damage > 20% equity), OPPORTUNITY_FLIP (deal ROI > 15% in < 30 ticks), MISSED_THE_BAG (passed deal that would have yielded > 10% ROI)","retry_count":0},
  {"task_id":"PZO_T00469","type":"create_module","phase":"PZO_P01_ENGINE_UPGRADE",
   "input":"pzo_engine/src/engine/turn-engine.ts: TurnEngine — full turn execution pipeline: validate → draw card → resolve card → apply buffs/debuffs → check wipe → check win → emit events → increment turn","retry_count":0},
  {"task_id":"PZO_T00470","type":"create_test","phase":"PZO_P01_ENGINE_UPGRADE",
   "input":"pzo_engine/src/engine/__tests__/real-rules.test.ts: Tests for real rules engine — shield absorbs FUBAR, consecutive_passes triggers MISSED_OPPORTUNITY, macro decay reduces idle cash, forced sale at 70%, 3-moment guarantee fires","retry_count":0},

  # ── PHASE 2 ADDITIONS ─────────────────────────────────────────
  {"task_id":"PZO_T00471","type":"create_module","phase":"PZO_P02_PERSISTENCE_LEADERBOARD",
   "input":"pzo_engine/src/persistence/db.ts: SQLite setup via better-sqlite3 — creates runs/events/leaderboard tables, migrations, singleton connection, WAL mode","retry_count":0},
  {"task_id":"PZO_T00472","type":"create_module","phase":"PZO_P02_PERSISTENCE_LEADERBOARD",
   "input":"pzo_engine/src/persistence/run-store.ts: RunStore — save(run), getById(id), getLeaderboard(limit), replayFromSeed(runId) — append-only event log, proof hash generation on save","retry_count":0},
  {"task_id":"PZO_T00473","type":"create_module","phase":"PZO_P02_PERSISTENCE_LEADERBOARD",
   "input":"pzo_engine/src/integrity/proof-hash.ts: ProofHash — SHA256(seed + canonical_actions_json + ruleset_version) — deterministic, includes ruleset_version per build guide integrity law","retry_count":0},
  {"task_id":"PZO_T00474","type":"create_module","phase":"PZO_P02_PERSISTENCE_LEADERBOARD",
   "input":"pzo_engine/src/api/server.ts: Express REST API — POST /runs, GET /leaderboard, GET /runs/:id/replay, GET /health — port 3001, CORS enabled, JSON only","retry_count":0},
  {"task_id":"PZO_T00475","type":"create_test","phase":"PZO_P02_PERSISTENCE_LEADERBOARD",
   "input":"pzo_engine/src/persistence/__tests__/proof-hash.test.ts: Proof hash tests — same inputs = same hash, different seed = different hash, ruleset_version change = different hash, tampered actions = different hash","retry_count":0},

  # ── PHASE 3 ADDITIONS ─────────────────────────────────────────
  {"task_id":"PZO_T00476","type":"create_module","phase":"PZO_P03_BROWSER_UI",
   "input":"pzo-web/src/App.tsx: Root app — React Router (/, /run/:seed, /run/:seed/result, /leaderboard, /replay/:runId) + Zustand provider + Tailwind base layout","retry_count":0},
  {"task_id":"PZO_T00477","type":"create_module","phase":"PZO_P03_BROWSER_UI",
   "input":"pzo-web/src/components/GameBoard.tsx: Main game screen — 12-minute countdown timer (requestAnimationFrame, no setInterval drift), energy bar, equity Recharts LineChart, hand of cards zone, macro erosion meter","retry_count":0},
  {"task_id":"PZO_T00478","type":"create_module","phase":"PZO_P03_BROWSER_UI",
   "input":"pzo-web/src/components/CardHand.tsx: Draggable card hand — @dnd-kit drag and drop, cards show name/type/cost/leverage/description, hover shows combo synergies, insufficient energy grays card","retry_count":0},
  {"task_id":"PZO_T00479","type":"create_module","phase":"PZO_P03_BROWSER_UI",
   "input":"pzo-web/src/components/BankruptcyScreen.tsx: Wipe screen — forensic cause display, clip-ready image generation (html2canvas), share button, 'See what killed me' CTA, play again button","retry_count":0},
  {"task_id":"PZO_T00480","type":"create_module","phase":"PZO_P03_BROWSER_UI",
   "input":"pzo-web/src/components/ProofCard.tsx: Run complete proof card — SHA256 hash visible, score/ROI/drawdown, 3 moment stamps, shareable image export, leaderboard position badge","retry_count":0},
  {"task_id":"PZO_T00481","type":"create_module","phase":"PZO_P03_BROWSER_UI",
   "input":"pzo-web/src/store/game-store.ts: Zustand game store — runState, marketState, energy, timer, actionLog, dispatch(action) — syncs with GameEngine event bus","retry_count":0},
  {"task_id":"PZO_T00482","type":"create_module","phase":"PZO_P03_BROWSER_UI",
   "input":"pzo-web/src/hooks/useGameEngine.ts: React hook — initializes GameEngine, wires event bus to Zustand store, manages requestAnimationFrame tick loop, cleanup on unmount","retry_count":0},

  # ── PHASE 4 ADDITIONS ─────────────────────────────────────────
  {"task_id":"PZO_T00483","type":"create_module","phase":"PZO_P04_MULTIPLAYER",
   "input":"pzo-server/src/ws/room-manager.ts: RoomManager — create(seed), join(roomId, playerId), tick(roomId) broadcasts authoritative state to all players, max 4 players/room, seed = room ID basis","retry_count":0},
  {"task_id":"PZO_T00484","type":"create_module","phase":"PZO_P04_MULTIPLAYER",
   "input":"pzo-server/src/ws/socket-server.ts: Socket.io server on port 3002 — events: join_room, submit_action, leave_room, disconnect — server validates action, broadcasts result to room","retry_count":0},
  {"task_id":"PZO_T00485","type":"create_module","phase":"PZO_P04_MULTIPLAYER",
   "input":"pzo-server/src/ws/action-validator.ts: Server-side action validator — validates PLAY_CARD (card in hand, energy sufficient, target symbol valid), DRAW, PASS — rejects with reason on failure","retry_count":0},
  {"task_id":"PZO_T00486","type":"create_module","phase":"PZO_P04_MULTIPLAYER",
   "input":"pzo-server/src/cron/daily-seed.ts: Daily gauntlet cron — rotates daily_seed at midnight UTC, stores in SQLite, GET /daily-seed returns {seed, date, leaderboard_count}","retry_count":0},

  # ── PHASE 5 ML ADDITIONS ──────────────────────────────────────
  {"task_id":"PZO_T00487","type":"create_module","phase":"PZO_P05_ML_MONETIZATION",
   "input":"pzo_ml/src/lib/audit-hash.ts: Shared ML audit hash — SHA256(canonical_json({inputs, outputs, model_id, ruleset_version})) — all 150 ML models use this exact function","retry_count":0},
  {"task_id":"PZO_T00488","type":"create_module","phase":"PZO_P05_ML_MONETIZATION",
   "input":"pzo_ml/src/lib/ml-base.ts: MLModel abstract base — ml_enabled kill-switch (returns null if false), bounded output enforcer (clamp 0-1), top_factors builder, audit_hash attachment, inference logging","retry_count":0},
  {"task_id":"PZO_T00489","type":"implement_feature","phase":"PZO_P05_ML_MONETIZATION",
   "input":"pzo_ml/src/models/m03a_solvency_collapse_predictor.ts: M03a — Solvency Collapse Predictor — extends MLBase — inputs: {RunSeed, TickIndex, MacroRegime, PortfolioSnapshot, ActionTimeline} — gradient-boosted tree (pure TS, deterministic) — output: {score, top_factors, recommendation, audit_hash}","retry_count":0},
  {"task_id":"PZO_T00490","type":"implement_feature","phase":"PZO_P05_ML_MONETIZATION",
   "input":"pzo_ml/src/models/m04a_deck_reactor_rl_policy.ts: M04a — Deck Reactor RL Policy — extends MLBase — constrained contextual bandit (hard draw weight caps: FUBAR max 40%, OPPORTUNITY min 30%) — inputs: {creditTightness, consecutivePasses, tickIndex, momentDeficit} — output: {drawWeights, recommendation, audit_hash}","retry_count":0},
  {"task_id":"PZO_T00491","type":"implement_feature","phase":"PZO_P05_ML_MONETIZATION",
   "input":"pzo_ml/src/models/m09a_opportunity_ev_regret_model.ts: M09a — Opportunity EV + Regret Model — extends MLBase — inputs: {card, portfolio, macroState, tickIndex} — EV = expectedCashflow * (720-tick)/720 * leverageMultiplier — regret_delta = EV if player passed — output: {ev_score, regret_delta, regret_card_payload, audit_hash}","retry_count":0},
  {"task_id":"PZO_T00492","type":"create_test","phase":"PZO_P05_ML_MONETIZATION",
   "input":"pzo_ml/src/models/__tests__/ml-base.test.ts: ML base tests — kill-switch returns null, output clamped to 0-1, audit_hash changes with ruleset_version, top_factors is non-empty array, competitive mode blocks all ML","retry_count":0},

  # ── MONETIZATION ─────────────────────────────────────────────
  {"task_id":"PZO_T00493","type":"create_module","phase":"PZO_P05_ML_MONETIZATION",
   "input":"pzo-server/src/monetization/paywall.ts: Paywall middleware — verifies GHL webhook subscription header, checks daily seed limit (1 free/day per IP+player), returns 402 with upgrade_url on limit hit","retry_count":0},
  {"task_id":"PZO_T00494","type":"create_module","phase":"PZO_P05_ML_MONETIZATION",
   "input":"pzo-server/src/monetization/ghl-webhook.ts: GHL webhook handler — run_complete triggers contact update, bankruptcy triggers nurture sequence, first_purchase tags as Customer — HMAC signature verification required","retry_count":0},
  {"task_id":"PZO_T00495","type":"create_docs","phase":"PZO_P05_ML_MONETIZATION",
   "input":"docs/pzo/monetization/REVENUE_ARCHITECTURE.md: Full monetization map — Daily Gauntlet free tier, Seed Pack $4.99, Season Pass $9.99/mo, Founder Pack $49, Premium Card Packs $2.99 — GHL pipeline stages, Stripe webhook flow, upgrade CTAs","retry_count":0},

  # ── LAUNCH / GTM ADDITIONS ────────────────────────────────────
  {"task_id":"PZO_T00496","type":"create_docs","phase":"PZO_P06_LAUNCH_GTM",
   "input":"docs/pzo/launch/LAUNCH_CHECKLIST.md: Pre-launch checklist — all 8 sessions complete, 17+ tests passing, proof hash deterministic, daily seed rotating, paywall live, GHL webhooks firing, no pause menu anywhere, 3-moment guarantee verified","retry_count":0},
  {"task_id":"PZO_T00497","type":"create_module","phase":"PZO_P06_LAUNCH_GTM",
   "input":"scripts/pzo/launch_smoke_test.sh: End-to-end smoke test — starts server, runs a full 720-tick sim via API, verifies proof hash, checks leaderboard, verifies daily seed endpoint, kills server, prints PASS/FAIL","retry_count":0},
  {"task_id":"PZO_T00498","type":"create_docs","phase":"PZO_P06_LAUNCH_GTM",
   "input":"docs/pzo/launch/INVESTOR_DEMO_SCRIPT.md: Investor demo script — 5-minute walkthrough: show engine running (npm run demo), show browser UI, play 3 cards, trigger Gamma Squeeze, show proof card, show leaderboard, show daily gauntlet CTA","retry_count":0},
  {"task_id":"PZO_T00499","type":"create_module","phase":"PZO_P06_LAUNCH_GTM",
   "input":"scripts/pzo/pzo_full_pipeline.sh: Master pipeline — runs all phases sequentially: preflight → P01 engine → P02 persistence → P03 UI → P04 multiplayer → P05 ML/monetization → launch smoke test — with phase-by-phase DoD gates","retry_count":0},
  {"task_id":"PZO_T00500","type":"create_docs","phase":"PZO_P00_TASKBOOK_AUTOMATION",
   "input":"docs/pzo/taskbook/master_taskbook_PZO_AUTOMATION_v1_3_COMPLETE.md: Full task index — all 500 tasks listed by phase, type, file path — current completion status — definition of done per phase — next session command","retry_count":0},
]

for task in tasks:
    print(json.dumps(task))

print(f"\n# Generated {len(tasks)} tasks: PZO_T00451 → PZO_T00500", file=__import__('sys').stderr)
