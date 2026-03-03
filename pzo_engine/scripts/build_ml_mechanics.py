#!/usr/bin/env python3
"""
Point Zero One — scripts/build_ml_mechanics.py
═══════════════════════════════════════════════════════════════════════════════
ML companion mechanic build system — Density6 LLC rebuild.

Reads:
  ml/*.md                  ← optional per-mechanic spec files (M01a–M150a)
  mechanics/*.md           ← optional core mechanic specs

Writes:
  pzo-web/src/data/ml_mechanics_core.json   ← extended registry (150 records)
  pzo-web/src/data/ml_core.json             ← mlLoader-compatible registry
  pzo_engine/src/ml/mXXa_*.ts              ← 150 standalone TypeScript ML stubs
  pzo_engine/src/ml/index.ts               ← Barrel export
  pzo_engine/src/ml/MLMechanicsRouter.ts   ← Dispatch table

Run:
  python3 scripts/build_ml_mechanics.py [--dry-run] [--only M01a,M06a] [--force]
  python3 scripts/build_ml_mechanics.py --stats
  python3 scripts/build_ml_mechanics.py --validate

Three structural patterns:
  Pattern A: M01a–M25a  (3 model tiers: Baseline, SequenceDL, PolicyRL)
  Pattern B: M26a–M75a  (4 model tiers: + GraphDL)
  Pattern C: M76a–M100a (ML/DL Core — 3 tiers, different schema)
  Pattern D: M101a–M150a (ML/DL Core — post-M100 batch)
  Special:   M25a, M95a (causal), M132a (causal + retrieval)

ML Design Laws (non-negotiable in every stub):
  ✦ ML can suggest; rules decide — NEVER rewrite resolved ledger history
  ✦ Bounded nudges — every output has explicit caps + monotonic constraints
  ✦ Auditability — every inference writes (ruleset_version, seed, tick, cap, output)
  ✦ Privacy — no contact-graph mining; in-session signals only for social reasoning
  ✦ Competitive lock — ML influence can be disabled; anti-cheat still runs

Density6 LLC · Point Zero One · Confidential · All Rights Reserved
═══════════════════════════════════════════════════════════════════════════════
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Literal

# ══════════════════════════════════════════════════════════════════════════════
# PATH RESOLUTION
# Configured for the Point Zero One master workspace.
# Override via CLI flags if paths differ on your machine.
# ══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR   = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent  # pzo-web/../  (point_zero_one_master)

# If the script lives inside pzo_engine/scripts, PROJECT_ROOT is pzo_engine's parent.
# Explicit workspace root to be safe:
WORKSPACE_ROOT = Path.home() / "workspaces/adam/Projects/adam/point_zero_one_master"

ML_DIR        = WORKSPACE_ROOT / "ml"
MECHANICS_DIR = WORKSPACE_ROOT / "mechanics"

# ── Outputs ───────────────────────────────────────────────────────────────────
WEB_DATA_DIR  = WORKSPACE_ROOT / "pzo-web" / "src" / "data"
JSON_OUT      = WEB_DATA_DIR / "ml_mechanics_core.json"    # Extended registry
ML_CORE_OUT   = WEB_DATA_DIR / "ml_core.json"              # mlLoader-compatible
LOADER_OUT    = WEB_DATA_DIR / "mlLoader.ts"               # Patched loader

TS_OUT_DIR    = WORKSPACE_ROOT / "pzo_engine" / "src" / "ml"
MECH_TS_DIR   = WORKSPACE_ROOT / "pzo_engine" / "src" / "mechanics"

# ══════════════════════════════════════════════════════════════════════════════
# TYPE ALIASES
# ══════════════════════════════════════════════════════════════════════════════

ModelTier      = Literal["baseline", "sequence_dl", "graph_dl", "policy_rl", "causal", "retrieval"]
InferPlacement = Literal["client", "server", "post_run"]
BudgetType     = Literal["real_time", "batch", "hybrid"]
MLCategory     = Literal[
    "classifier", "predictor", "recommender", "rl_policy",
    "anomaly_detector", "generator", "controller", "embedding_model",
]
MLIntelSignal  = Literal[
    "alpha", "risk", "volatility", "antiCheat", "personalization",
    "rewardFit", "recommendationPower", "churnRisk", "momentum",
]
MLFamily       = Literal[
    "integrity", "market", "social", "contract", "economy",
    "progression", "balance", "forensics", "co_op",
]
MLStatus       = Literal["simulated", "wiring", "training", "deployed"]


# ══════════════════════════════════════════════════════════════════════════════
# CANONICAL ML TABLE — 150 records
# Ground truth for every generated artefact.
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class MLMechanicMeta:
    ml_id:            str            # M01a
    core_id:          str            # M01
    model_name:       str            # human-readable title
    primary_function: str            # runtime one-liner
    what_it_adds:     list[str]      # 2–4 bullets
    tiers:            list[ModelTier]
    placement:        list[InferPlacement]
    budget:           BudgetType
    primary_outputs:  list[str]
    eval_focus:       list[str]
    # ── mlLoader bridge fields ────────────────────────────────────────────────
    intelligence_signal: MLIntelSignal = "risk"
    model_category:      MLCategory   = "predictor"
    family:              MLFamily      = "market"
    can_lock_off:        bool          = True
    status:              MLStatus      = "simulated"
    priority:            int           = 2       # 1=critical, 2=standard, 3=nice-to-have
    training_phase:      int           = 2       # 1=now, 2=after 100 runs, 3=after 500 runs


# ─── Full 150-mechanic table ──────────────────────────────────────────────────
ML_TABLE: list[MLMechanicMeta] = [

    # ═══ PATTERN A: M01a–M25a · 3 tiers ═════════════════════════════════════

    MLMechanicMeta(
        ml_id="M01a", core_id="M01",
        model_name="Seed Integrity + Deterministic Replay Forensics",
        primary_function="Detect replay/seed tampering and impossible action sequences; output a signed Replay Integrity Score",
        what_it_adds=[
            "Detect replay/seed tampering and impossible action sequences while keeping runs deterministic.",
            "Uses lightweight anomaly detection over action timelines + consistency checks against the deterministic simulator.",
            "Outputs a signed 'Replay Integrity Score' for challenges, leaderboards, and share links.",
        ],
        tiers=["baseline", "sequence_dl", "policy_rl"],
        placement=["client", "server"],
        budget="real_time",
        primary_outputs=["replay_integrity_score", "tamper_probability", "impossible_sequence_flags", "signed_receipt"],
        eval_focus=["false_positive_rate_on_lag_spikes", "tamper_detection_AUC", "replay_consistency_delta"],
        intelligence_signal="antiCheat", model_category="anomaly_detector", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M02a", core_id="M02",
        model_name="Pressure-Aware Difficulty Shaping (Timer Stress Model)",
        primary_function="Predict player stress from timer + decision cadence and adjust difficulty envelope without breaking determinism",
        what_it_adds=[
            "Predict when timer pressure crosses from 'tense' to 'unfair' and adjust difficulty envelope (not outcomes).",
            "Learns individual decision-speed baselines; flags sessions where external lag inflates perceived stress.",
            "Feeds the Pressure Journal (M132) and clutch UI timing.",
        ],
        tiers=["baseline", "sequence_dl", "policy_rl"],
        placement=["client", "server"],
        budget="real_time",
        primary_outputs=["stress_score", "decision_speed_baseline", "difficulty_envelope_delta", "lag_flag"],
        eval_focus=["calibration_ECE", "fairness_drift_across_skill_bands", "lag_false_positive_rate"],
        intelligence_signal="personalization", model_category="controller", family="balance",
        can_lock_off=True, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M03a", core_id="M03",
        model_name="Solvency Collapse Predictor (Run Death Forecaster)",
        primary_function="Predict probability of wipe in the next N ticks; explain top contributing factors for post-mortems and clutch windows",
        what_it_adds=[
            "Predict probability of wipe in the next N ticks and explain the top contributing factors (fees, debt service, macro squeeze).",
            "Feeds post-mortems and 'near-death' clutch windows.",
            "Used for tutorial hints ONLY if user opts in; otherwise used silently for balancing and analytics.",
        ],
        tiers=["baseline", "sequence_dl", "policy_rl"],
        placement=["client", "server"],
        budget="real_time",
        primary_outputs=["wipe_probability_next_n_ticks", "top_collapse_factors", "clutch_window_flag", "tutorial_hint"],
        eval_focus=["wipe_prediction_AUC", "precision_at_high_recall", "opt_in_hint_acceptance_rate"],
        intelligence_signal="risk", model_category="predictor", family="market",
        can_lock_off=True, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M04a", core_id="M04",
        model_name="Deck Reactor RL Policy (Dynamic Draw Mixing)",
        primary_function="Learn optimal draw-pool composition per player archetype and macro regime; keep draws surprising yet fair",
        what_it_adds=[
            "Learn optimal draw-pool composition per player archetype and macro regime.",
            "Balances surprise vs. fairness: ensures every run has ≥ 3 share moments without rigging outcomes.",
            "Adaptive curriculum: shifts pool toward player-skill edges without breaking determinism.",
        ],
        tiers=["baseline", "sequence_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["draw_pool_weights", "archetype_embedding", "surprise_score", "moment_budget_remaining"],
        eval_focus=["moment_yield_per_run", "draw_entropy", "skill_band_fairness"],
        intelligence_signal="recommendationPower", model_category="rl_policy", family="balance",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M05a", core_id="M05",
        model_name="Macro Regime Classifier + Cash Decay Tuner",
        primary_function="Classify current market regime from run state signals; tune cash decay rate to stay within design bounds",
        what_it_adds=[
            "Classify current market regime in real time and tune cash decay rate within bounded design envelope.",
            "Ensures regime transitions feel earned, not arbitrary; detects when macro is too punishing for skill band.",
            "Drives Macro Shock Scheduler (M20) pre-computation.",
        ],
        tiers=["baseline", "sequence_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["regime_classification", "regime_confidence", "decay_rate_delta", "transition_probability"],
        eval_focus=["regime_classification_accuracy", "false_transition_rate", "decay_calibration_ECE"],
        intelligence_signal="volatility", model_category="classifier", family="market",
        can_lock_off=True, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M06a", core_id="M06",
        model_name="Cashflow Forecast + Portfolio Health Embeddings",
        primary_function="Forecast next K cashflow ticks; generate portfolio embedding used for matching, balancing, and personalization",
        what_it_adds=[
            "Forecast next K cashflow ticks and generate a portfolio embedding used across the game (matching, balancing, personalization).",
            "Model learns patterns across asset combos, macro regimes, and player style.",
            "Drives 'moment cards' like 'cashflow spike' and 'bleed warning' (optional).",
        ],
        tiers=["baseline", "sequence_dl", "policy_rl"],
        placement=["client", "server"],
        budget="real_time",
        primary_outputs=["cashflow_forecast_k_ticks", "portfolio_embedding", "health_score", "bleed_warning_flag"],
        eval_focus=["forecast_MAE", "embedding_stability", "moment_card_precision"],
        intelligence_signal="alpha", model_category="embedding_model", family="market",
        can_lock_off=True, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M07a", core_id="M07",
        model_name="Affordability + Default Risk Scorer (Purchase Resolver)",
        primary_function="Score purchase affordability and downstream default risk before the leverage resolver commits; gate high-risk buys",
        what_it_adds=[
            "Score purchase affordability and downstream default risk before the leverage resolver commits.",
            "Flags buys that look affordable now but create a debt-service trap in N ticks.",
            "Feeds post-mortem 'worst decision' ranking in Case File.",
        ],
        tiers=["baseline", "sequence_dl", "policy_rl"],
        placement=["client", "server"],
        budget="real_time",
        primary_outputs=["affordability_score", "default_risk_score", "debt_trap_probability", "worst_decision_flag"],
        eval_focus=["default_risk_AUC", "debt_trap_recall", "false_gate_rate"],
        intelligence_signal="risk", model_category="predictor", family="market",
        can_lock_off=True, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M08a", core_id="M08",
        model_name="Shield Timing Policy (Clutch Intervention Model)",
        primary_function="Predict optimal timing for shields/cancels and friend clutch windows from imminent FUBAR cascade detection",
        what_it_adds=[
            "Predict optimal timing for shields/cancels and friend clutch windows.",
            "Uses sequence models to detect imminent multi-step FUBAR cascades.",
            "Outputs 'best save window' timestamps for UI and social assist prompts.",
        ],
        tiers=["baseline", "sequence_dl", "policy_rl"],
        placement=["client", "server"],
        budget="real_time",
        primary_outputs=["shield_optimal_tick", "clutch_window_open", "cascade_probability", "save_window_timestamps"],
        eval_focus=["shield_timing_precision", "clutch_window_recall", "cascade_detection_AUC"],
        intelligence_signal="momentum", model_category="rl_policy", family="balance",
        can_lock_off=True, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M09a", core_id="M09",
        model_name="Opportunity Value Model + Regret Stamp Generator",
        primary_function="Score opportunity value in context; generate regret stamps when a passed opportunity later proves pivotal",
        what_it_adds=[
            "Score opportunity value in the context of the player's current position and macro regime.",
            "Generates a regret stamp when a passed opportunity later proves pivotal.",
            "Feeds the 'missed the bag' share-moment hook.",
        ],
        tiers=["baseline", "sequence_dl", "policy_rl"],
        placement=["client", "server"],
        budget="real_time",
        primary_outputs=["opportunity_value_score", "regret_probability", "regret_stamp", "share_moment_flag"],
        eval_focus=["opportunity_value_calibration", "regret_stamp_precision", "share_moment_yield"],
        intelligence_signal="alpha", model_category="predictor", family="market",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M10a", core_id="M10",
        model_name="Exit Timing Model (Pulse Sell / Flip Optimizer)",
        primary_function="Predict optimal exit timing per asset given macro pulse; highlight flip opportunities without guaranteeing outcomes",
        what_it_adds=[
            "Predict optimal exit timing per asset given the current macro pulse and portfolio composition.",
            "Highlights flip opportunities without guaranteeing outcomes (bounded suggestion only).",
            "Contributes to 'opportunity flip' share-moment detection.",
        ],
        tiers=["baseline", "sequence_dl", "policy_rl"],
        placement=["client", "server"],
        budget="real_time",
        primary_outputs=["exit_timing_score", "flip_probability", "optimal_exit_tick_estimate", "moment_flag"],
        eval_focus=["exit_timing_calibration", "flip_precision", "opportunity_flip_yield"],
        intelligence_signal="alpha", model_category="predictor", family="market",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M11a", core_id="M11",
        model_name="Hesitation / Inertia Detector (Micro-Behavior DL)",
        primary_function="Detect hesitation and decision inertia patterns from UI micro-behavior; flag inertia before Inertia Tax fires",
        what_it_adds=[
            "Detect hesitation and decision inertia patterns from UI hover loops, timer behavior, and action cadence.",
            "Flags inertia early so the Inertia Tax (M11) feels earned, not surprising.",
            "Feeds adaptive difficulty: persistent inertia → consider reducing noise, not reducing challenge.",
        ],
        tiers=["baseline", "sequence_dl", "policy_rl"],
        placement=["client"],
        budget="real_time",
        primary_outputs=["inertia_score", "hesitation_pattern", "inertia_tax_warning", "adaptive_difficulty_signal"],
        eval_focus=["inertia_detection_AUC", "false_positive_on_deliberate_pauses", "adaptive_difficulty_fairness"],
        intelligence_signal="personalization", model_category="classifier", family="balance",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M12a", core_id="M12",
        model_name="FUBAR Cascade Risk Model (Crisis Graph)",
        primary_function="Model crisis as an interacting risk graph; predict cascade probability and chain path for legible failures",
        what_it_adds=[
            "Model crisis as a graph of interacting risks; predict cascade probability and likely chain path.",
            "Enables dramatic but legible failures: the player can see the dominoes.",
            "Supports balancing by identifying overpowered crisis combos.",
        ],
        tiers=["baseline", "sequence_dl", "policy_rl"],
        placement=["client", "server"],
        budget="real_time",
        primary_outputs=["cascade_probability", "chain_path_prediction", "overpowered_combo_flag", "domino_visualization_data"],
        eval_focus=["cascade_AUC", "chain_path_accuracy", "combo_balance_flag_precision"],
        intelligence_signal="risk", model_category="predictor", family="market",
        can_lock_off=True, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M13a", core_id="M13",
        model_name="Friction Module Tuner (Constrained Bandits)",
        primary_function="Tune SO friction module severity within design bounds to keep friction feeling meaningful, not punishing",
        what_it_adds=[
            "Tune SO friction module severity within bounded design envelope.",
            "Learns per-skill-band tolerances; prevents friction from feeling punishing vs. meaningful.",
            "Feeds season balancing reports.",
        ],
        tiers=["baseline", "policy_rl"],
        placement=["server"],
        budget="batch",
        primary_outputs=["friction_severity_delta", "skill_band_tolerance", "season_balance_report_signal"],
        eval_focus=["friction_perceived_fairness", "rage_quit_correlation", "season_stability"],
        intelligence_signal="personalization", model_category="controller", family="balance",
        can_lock_off=True, priority=2, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M14a", core_id="M14",
        model_name="Disadvantage Draft Personalizer (Style-Aware)",
        primary_function="Recommend handicap combinations that match player style while preserving CORD premium fairness",
        what_it_adds=[
            "Recommend handicap combinations that challenge the player's specific weak spots without being punishing.",
            "Learns style fingerprints; personalizes disadvantage draft without breaking CORD premium fairness.",
            "Detects players deliberately sandbagging via handicap selection.",
        ],
        tiers=["baseline", "sequence_dl", "policy_rl"],
        placement=["client", "server"],
        budget="real_time",
        primary_outputs=["recommended_handicaps", "style_fingerprint", "sandbag_flag", "cord_premium_fairness_score"],
        eval_focus=["handicap_acceptance_rate", "sandbag_detection_precision", "cord_premium_calibration"],
        intelligence_signal="personalization", model_category="recommender", family="progression",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M15a", core_id="M15",
        model_name="Social Token Recommender (Co-Author Engine)",
        primary_function="Recommend which social chaos token to play and when for maximum narrative impact without griefing",
        what_it_adds=[
            "Recommend which social chaos token to play and when for maximum narrative impact.",
            "Learns social graph dynamics: who benefits whom, which tokens create shared-regret moments.",
            "Anti-grief filter: suppresses tokens predicted to feel punishing rather than dramatic.",
        ],
        tiers=["baseline", "sequence_dl", "policy_rl"],
        placement=["client", "server"],
        budget="real_time",
        primary_outputs=["token_recommendation", "narrative_impact_score", "grief_probability", "co_author_match"],
        eval_focus=["narrative_moment_yield", "grief_report_rate", "token_acceptance_rate"],
        intelligence_signal="rewardFit", model_category="recommender", family="social",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M16a", core_id="M16",
        model_name="Consensus vs Contrarian Predictor (Hot Seat Vote)",
        primary_function="Predict vote outcome distribution and surface minority-view confidence to improve decision quality at the table",
        what_it_adds=[
            "Predict vote outcome distribution and surface contrarian confidence where minority view is well-founded.",
            "Reduces groupthink at the table without overriding player choice.",
            "Feeds 'surprising consensus' share-moment detection.",
        ],
        tiers=["baseline", "sequence_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["vote_distribution_prediction", "contrarian_confidence", "groupthink_flag", "consensus_moment_flag"],
        eval_focus=["vote_calibration_ECE", "contrarian_surface_precision", "groupthink_reduction_rate"],
        intelligence_signal="recommendationPower", model_category="predictor", family="social",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M17a", core_id="M17",
        model_name="Bailout Trigger Classifier (Clutch Assist Gate)",
        primary_function="Classify whether a bailout request is a genuine clutch moment vs. learned helplessness or abuse",
        what_it_adds=[
            "Classify whether a bailout request is a genuine clutch moment or learned helplessness / abuse.",
            "Calibrates bailout availability to preserve drama without enabling grinding.",
            "Outputs 'clutch assist' label for share-moment detection.",
        ],
        tiers=["baseline", "sequence_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["bailout_legitimacy_score", "abuse_probability", "clutch_label", "helplessness_flag"],
        eval_focus=["clutch_precision", "abuse_detection_AUC", "bailout_drama_yield"],
        intelligence_signal="momentum", model_category="classifier", family="balance",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M18a", core_id="M18",
        model_name="Griefing Detection + Adversarial Budgeting",
        primary_function="Detect sabotage patterns crossing from competitive play into griefing; adjust adversarial budget in real time",
        what_it_adds=[
            "Detect sabotage patterns that cross from competitive play into griefing.",
            "Adjusts adversarial budget in real time without hard-blocking legitimate aggression.",
            "Feeds Exploit Taxonomy (M49) escalation pipeline.",
        ],
        tiers=["baseline", "sequence_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["grief_probability", "adversarial_budget_delta", "escalation_flag", "legitimate_aggression_score"],
        eval_focus=["grief_precision", "legitimate_aggression_false_positive_rate", "exploit_escalation_AUC"],
        intelligence_signal="antiCheat", model_category="anomaly_detector", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M19a", core_id="M19",
        model_name="Season Meta Balancer (Offline Simulation + RL)",
        primary_function="Run offline simulations to balance season rule modules; ensure no single ruleset dominates the meta",
        what_it_adds=[
            "Run offline simulations to balance season rule modules before they go live.",
            "Ensures no single ruleset dominates the meta; detects imbalance early via sim rollouts.",
            "Feeds season design review with 'predicted dominant strategy' reports.",
        ],
        tiers=["baseline", "policy_rl"],
        placement=["server"],
        budget="batch",
        primary_outputs=["meta_balance_score", "dominant_strategy_flag", "module_imbalance_report", "sim_rollout_summary"],
        eval_focus=["meta_diversity_index", "dominant_strategy_suppression", "season_stability_KPI"],
        intelligence_signal="volatility", model_category="rl_policy", family="balance",
        can_lock_off=True, priority=2, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M20a", core_id="M20",
        model_name="Macro Shock Generator (Distribution + Constraints)",
        primary_function="Generate macro shock schedules that maximize dramatic impact while staying within bounded design constraints",
        what_it_adds=[
            "Generate macro shock schedules that maximize dramatic impact within bounded design constraints.",
            "Learns which shock sequences produce the highest share-moment yield without triggering rage-quit spikes.",
            "Ensures shocks feel earned: player state correlation, not pure randomness.",
        ],
        tiers=["baseline", "sequence_dl", "policy_rl"],
        placement=["server"],
        budget="batch",
        primary_outputs=["shock_schedule", "drama_impact_score", "rage_quit_risk", "moment_yield_estimate"],
        eval_focus=["share_moment_yield", "rage_quit_correlation", "shock_perceived_fairness"],
        intelligence_signal="volatility", model_category="generator", family="market",
        can_lock_off=True, priority=2, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M21a", core_id="M21",
        model_name="Meta-Progression Personalization (Unlock Routing)",
        primary_function="Route unlock progression to match player style and retention risk; prevent both under-challenge and overwhelm",
        what_it_adds=[
            "Route unlock progression to match player style, skill growth, and retention risk.",
            "Prevents both under-challenge (boredom) and complexity overwhelm.",
            "Feeds Progressive Disclosure (M67) gate scheduling.",
        ],
        tiers=["baseline", "sequence_dl", "policy_rl"],
        placement=["server"],
        budget="batch",
        primary_outputs=["unlock_route", "retention_risk_score", "overwhelm_flag", "progression_tier_delta"],
        eval_focus=["unlock_acceptance_rate", "retention_lift", "overwhelm_detection_AUC"],
        intelligence_signal="churnRisk", model_category="recommender", family="progression",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M22a", core_id="M22",
        model_name="Moment Forge Classifier (3-Moment Guarantee Controller)",
        primary_function="Classify in-run events for shareability; guarantee ≥3 share moments per run without scripting outcomes",
        what_it_adds=[
            "Classify in-run events for shareability and route moment budget to guarantee ≥3 share moments per run.",
            "Detects FUBAR-killed-me, opportunity-flip, and missed-the-bag events in real time.",
            "Never scripts outcomes; detects naturally occurring shareable moments.",
        ],
        tiers=["baseline", "sequence_dl", "policy_rl"],
        placement=["client", "server"],
        budget="real_time",
        primary_outputs=["moment_class", "shareability_score", "moment_budget_status", "clip_boundary_suggestion"],
        eval_focus=["moment_yield_per_run", "moment_precision", "false_moment_rate"],
        intelligence_signal="rewardFit", model_category="classifier", family="social",
        can_lock_off=True, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M23a", core_id="M23",
        model_name="Highlight Detection (Auto-Clip DL)",
        primary_function="Detect clip-worthy moments from audio/visual run signals; generate caption suggestions for auto-packager",
        what_it_adds=[
            "Detect clip-worthy moments from run state signals and generate caption suggestions.",
            "Learns what the community shares; improves clip quality over time.",
            "Privacy-safe: processes in-session signals only, no cross-player content mining.",
        ],
        tiers=["baseline", "sequence_dl", "policy_rl"],
        placement=["client"],
        budget="real_time",
        primary_outputs=["clip_start_tick", "clip_end_tick", "caption_suggestion", "shareability_score"],
        eval_focus=["clip_share_rate", "caption_acceptance_rate", "privacy_audit_pass"],
        intelligence_signal="rewardFit", model_category="classifier", family="social",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M24a", core_id="M24",
        model_name="Challenge Matchmaking (Seed + Ghost Similarity)",
        primary_function="Match challenge links to players with similar skill profiles using run embeddings; maximize competitive relevance",
        what_it_adds=[
            "Match challenge links to players with similar skill profiles using run embeddings.",
            "Maximizes competitive relevance: neither too easy (boring) nor too hard (demoralizing).",
            "Anti-smurf: detects deliberate skill misrepresentation in challenge targeting.",
        ],
        tiers=["baseline", "sequence_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["challenge_match_score", "skill_similarity", "smurf_flag", "ghost_compatibility_score"],
        eval_focus=["match_acceptance_rate", "smurf_detection_AUC", "challenge_completion_rate"],
        intelligence_signal="personalization", model_category="embedding_model", family="progression",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M25a", core_id="M25",
        model_name="Improvement Overlay Models (Skill Signals + Causal Experiments)",
        primary_function="Estimate causal skill improvement from run history; surface actionable deltas without teaching optimal exploitation",
        what_it_adds=[
            "Estimate causal skill improvement using difference-in-differences and A/B-style natural experiments.",
            "Surfaces actionable deltas (decision speed, shield usage, opportunity capture) without teaching optimal exploitation.",
            "Respects opt-out: overlay is entirely user-triggered.",
        ],
        tiers=["baseline", "sequence_dl", "causal", "policy_rl"],
        placement=["client", "server"],
        budget="batch",
        primary_outputs=["skill_improvement_delta", "causal_estimate", "actionable_overlays", "exploitation_guard_passed"],
        eval_focus=["causal_estimate_validity", "skill_improvement_lift", "exploitation_guard_AUC"],
        intelligence_signal="personalization", model_category="predictor", family="progression",
        can_lock_off=True, priority=2, training_phase=3,
    ),

    # ═══ PATTERN B: M26a–M75a · 4 tiers · + Graph DL ════════════════════════

    MLMechanicMeta(
        ml_id="M26a", core_id="M26",
        model_name="Co-op Contract Fairness + Partner-Risk Scorer",
        primary_function="Score contract fairness and partner default risk using contract graph structure; flag exploitative terms",
        what_it_adds=[
            "Score contract fairness and partner default risk using the contract graph structure.",
            "Flags exploitative terms (asymmetric liability, hidden clauses) before signing.",
            "Learns partner reliability from historical ledger data.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["fairness_score", "partner_default_risk", "exploitative_term_flags", "reliability_embedding"],
        eval_focus=["fairness_calibration", "default_risk_AUC", "exploitative_term_recall"],
        intelligence_signal="risk", model_category="predictor", family="contract",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M27a", core_id="M27",
        model_name="Clause Outcome Forecaster (Triggers, Escapes, Penalties)",
        primary_function="Forecast probability of each contract clause triggering; surface under-appreciated penalty exposure",
        what_it_adds=[
            "Forecast probability of each contract clause triggering given current run state.",
            "Surfaces under-appreciated penalty exposure before the clause fires.",
            "Feeds arbitration triage (M55a) with pre-computed clause risk.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["clause_trigger_probabilities", "penalty_exposure", "escape_window_estimate", "arbitration_precompute"],
        eval_focus=["clause_trigger_calibration_ECE", "penalty_exposure_recall", "arbitration_precompute_accuracy"],
        intelligence_signal="risk", model_category="predictor", family="contract",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M28a", core_id="M28",
        model_name="Handshake Negotiation Coach (Timer-Window Optimizer)",
        primary_function="Coach negotiation timing and term selection within handshake windows; maximize mutual agreement probability",
        what_it_adds=[
            "Coach negotiation timing and term selection within handshake windows.",
            "Maximizes mutual agreement probability without revealing counterpart strategy.",
            "Detects and flags one-sided negotiations approaching exploitation threshold.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["client", "server"],
        budget="real_time",
        primary_outputs=["negotiation_coach_suggestion", "agreement_probability", "exploitation_flag", "optimal_counter_terms"],
        eval_focus=["agreement_rate_lift", "exploitation_detection_AUC", "timer_utilization_efficiency"],
        intelligence_signal="recommendationPower", model_category="recommender", family="contract",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M29a", core_id="M29",
        model_name="Mutual Risk Pool Actuary (Payout Likelihood + Anti-Abuse)",
        primary_function="Actuarially score risk pool payout likelihood; detect coordinated abuse of mutual insurance mechanics",
        what_it_adds=[
            "Actuarially score risk pool payout likelihood given current run state and partner history.",
            "Detects coordinated abuse: players gaming mutual insurance for guaranteed payouts.",
            "Feeds pool sustainability reports for season balancing.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["payout_probability", "abuse_probability", "pool_sustainability_score", "coordinated_abuse_flag"],
        eval_focus=["payout_calibration_ECE", "abuse_detection_AUC", "pool_sustainability_KPI"],
        intelligence_signal="antiCheat", model_category="anomaly_detector", family="co_op",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M30a", core_id="M30",
        model_name="Default Cascade Predictor (Takeover vs Unwind Routing)",
        primary_function="Predict whether partner default cascades into multi-asset liquidation; propose least-degenerate unwind path",
        what_it_adds=[
            "Predict whether partner default will cascade into multi-asset liquidation and propose the least-degenerate unwind path.",
            "Detect betrayal-like patterns (strategic nonpayment) and tighten safeguards without deleting drama.",
            "Generates cinematic 'buyout flip' vs 'default wipe' proof cards.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["cascade_probability", "unwind_path_recommendation", "betrayal_pattern_flag", "proof_card_route"],
        eval_focus=["cascade_AUC", "betrayal_detection_precision", "unwind_path_optimality"],
        intelligence_signal="risk", model_category="predictor", family="co_op",
        can_lock_off=True, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M31a", core_id="M31",
        model_name="Synergy Discovery Engine (Combo Mining + Balance Watchdog)",
        primary_function="Mine discovered synergy combos across all player runs; flag overpowered sets before they dominate the meta",
        what_it_adds=[
            "Mine discovered synergy combos across all player runs to surface unintended power spikes.",
            "Flags overpowered sets before they dominate the meta.",
            "Generates 'emerging synergy' discoveries for season design reviews.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="batch",
        primary_outputs=["overpowered_combo_flags", "synergy_discovery_report", "meta_balance_delta", "design_review_digest"],
        eval_focus=["overpowered_combo_recall", "false_flag_rate", "meta_diversity_index"],
        intelligence_signal="volatility", model_category="anomaly_detector", family="balance",
        can_lock_off=True, priority=2, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M32a", core_id="M32",
        model_name="Liquidity Ladder Planner (Rung Completion + Fragility Scorer)",
        primary_function="Predict optimal rung completion sequence; score portfolio liquidity fragility under macro stress scenarios",
        what_it_adds=[
            "Predict optimal rung completion sequence given current portfolio and macro outlook.",
            "Score portfolio liquidity fragility under stress scenarios.",
            "Flags ladder structures vulnerable to cascade liquidation.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["client", "server"],
        budget="real_time",
        primary_outputs=["rung_completion_plan", "liquidity_fragility_score", "cascade_liquidation_risk", "stress_scenario_results"],
        eval_focus=["fragility_score_calibration", "cascade_prediction_AUC", "rung_completion_rate"],
        intelligence_signal="risk", model_category="predictor", family="market",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M33a", core_id="M33",
        model_name="Hedge Pair Validator (Correlation Drift + Shock Stress)",
        primary_function="Validate hedge pair correlation stability under macro regimes; flag pairs that lose protection under shock",
        what_it_adds=[
            "Validate hedge pair correlation stability under different macro regimes.",
            "Flags pairs that lose their protective correlation under macro shocks.",
            "Generates hedge effectiveness receipts for Case File.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["correlation_stability_score", "shock_vulnerability_flag", "hedge_effectiveness_receipt", "regime_sensitivity"],
        eval_focus=["correlation_prediction_accuracy", "shock_vulnerability_recall", "hedge_effectiveness_calibration"],
        intelligence_signal="risk", model_category="predictor", family="market",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M34a", core_id="M34",
        model_name="Mod Impact Estimator (Socket Choice + Counterfactual Regret)",
        primary_function="Estimate marginal impact of each mod socket choice; compute counterfactual regret for missed combinations",
        what_it_adds=[
            "Estimate marginal impact of each mod socket choice given current portfolio state.",
            "Compute counterfactual regret for missed mod combinations.",
            "Feeds asset mod recommendation in Case File.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["client", "server"],
        budget="real_time",
        primary_outputs=["mod_impact_estimate", "counterfactual_regret_score", "socket_recommendation", "missed_combo_flags"],
        eval_focus=["impact_estimate_accuracy", "regret_stamp_precision", "recommendation_acceptance_rate"],
        intelligence_signal="alpha", model_category="recommender", family="market",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M35a", core_id="M35",
        model_name="Portfolio Heat Controller (Overconcentration + Friction Tuner)",
        primary_function="Control portfolio heat exposure to stay within design bounds; detect overconcentration before it creates unfair failure",
        what_it_adds=[
            "Control portfolio heat exposure to stay within design bounds per skill band.",
            "Detects overconcentration before it creates unfair cascade failure.",
            "Feeds Exposure Cap warnings (M35) and Complexity Heat Monitor (M59).",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["heat_control_delta", "overconcentration_flag", "cascade_risk_score", "skill_band_adjustment"],
        eval_focus=["heat_calibration_ECE", "overconcentration_recall", "cascade_prevention_rate"],
        intelligence_signal="risk", model_category="controller", family="market",
        can_lock_off=True, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M36a", core_id="M36",
        model_name="Achievement Proof Verifier (Ledger-Backed Badge Integrity)",
        primary_function="Verify achievement proof chain against ledger; detect fabricated or duplicated badge claims",
        what_it_adds=[
            "Verify achievement proof chains against ledger events for badge integrity.",
            "Detect fabricated or duplicated badge claims using replay consistency checks.",
            "Outputs a confidence score for every issued badge.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="batch",
        primary_outputs=["badge_integrity_score", "fabrication_probability", "duplicate_flag", "ledger_consistency_score"],
        eval_focus=["badge_integrity_AUC", "fabrication_recall", "false_flag_rate"],
        intelligence_signal="antiCheat", model_category="anomaly_detector", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M37a", core_id="M37",
        model_name="Bounty Failure Forecaster (Streak Collapse Predictor)",
        primary_function="Forecast streak collapse probability before bounty commitment; prevent demoralizing bounty failures",
        what_it_adds=[
            "Forecast streak collapse probability before the player commits to a bounty.",
            "Surfaces risk of demoralizing bounty failure without preventing player from accepting.",
            "Feeds bounty economy balancer (M65a) with failure rate signals.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "causal"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["collapse_probability", "demoralization_risk", "bounty_risk_tier", "economy_balance_signal"],
        eval_focus=["collapse_AUC", "demoralization_risk_calibration", "economy_inflation_rate"],
        intelligence_signal="churnRisk", model_category="predictor", family="economy",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M38a", core_id="M38",
        model_name="Quest Router (Moment Quest Personalization + Novelty)",
        primary_function="Route moment quests to maximize player novelty and share probability without repeating quest archetypes",
        what_it_adds=[
            "Route moment quests to maximize player novelty and share probability.",
            "Avoids repeating quest archetypes the player has already mastered.",
            "Feeds quest completion analytics for season design.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["quest_route_recommendation", "novelty_score", "share_probability", "archetype_mastery_map"],
        eval_focus=["quest_completion_rate", "share_yield", "novelty_entropy"],
        intelligence_signal="recommendationPower", model_category="recommender", family="progression",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M39a", core_id="M39",
        model_name="Trophy Economy Balancer (Inflation Control + Anti-Farm)",
        primary_function="Balance trophy currency inflation and sink adequacy; detect farm patterns before they degrade the economy",
        what_it_adds=[
            "Balance trophy currency inflation and sink adequacy across the season.",
            "Detect farm patterns (repeated low-effort runs for trophy grinding) before they degrade the economy.",
            "Generates inflation control recommendations for season design.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="batch",
        primary_outputs=["inflation_index", "farm_pattern_flags", "sink_adequacy_score", "design_recommendations"],
        eval_focus=["inflation_stability", "farm_detection_AUC", "sink_adequacy_KPI"],
        intelligence_signal="volatility", model_category="controller", family="economy",
        can_lock_off=True, priority=2, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M40a", core_id="M40",
        model_name="Cosmetic Exchange Fraud Detector (Market Integrity)",
        primary_function="Detect fraudulent cosmetic exchange patterns including wash trading, duplication exploits, and collusion rings",
        what_it_adds=[
            "Detect wash trading, duplication exploits, and collusion rings in the cosmetic exchange market.",
            "Uses graph anomaly detection over transaction networks.",
            "Outputs fraud probability with explainable evidence chain.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["fraud_probability", "evidence_chain", "wash_trade_flag", "collusion_ring_flag"],
        eval_focus=["fraud_AUC", "wash_trade_recall", "false_positive_rate"],
        intelligence_signal="antiCheat", model_category="anomaly_detector", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M41a", core_id="M41",
        model_name="Onboarding Skill Estimator (90-Second Boot Run Classifier)",
        primary_function="Classify new player skill level from boot run behavior; route to appropriate starter path and difficulty",
        what_it_adds=[
            "Classify new player skill level from 90-second boot run decision patterns.",
            "Routes to appropriate starter path and initial difficulty without asking.",
            "Detects smurfs: experienced players hiding behind new accounts.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["skill_tier_classification", "starter_path_recommendation", "smurf_probability", "difficulty_route"],
        eval_focus=["skill_classification_accuracy", "smurf_detection_AUC", "onboarding_completion_lift"],
        intelligence_signal="personalization", model_category="classifier", family="progression",
        can_lock_off=True, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M42a", core_id="M42",
        model_name="Prompt Minimalism Controller (When to Speak, When to Stay Silent)",
        primary_function="Predict when a guided prompt adds value vs. breaks immersion; enforce minimalism without leaving players lost",
        what_it_adds=[
            "Predict when a guided prompt adds genuine value vs. breaks immersion.",
            "Enforces prompt minimalism: fewer, higher-signal prompts.",
            "Learns individual tolerance for guidance; respects opt-out permanently.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["client"],
        budget="real_time",
        primary_outputs=["prompt_value_score", "immersion_break_risk", "silence_recommendation", "individual_tolerance_estimate"],
        eval_focus=["prompt_acceptance_rate", "immersion_break_rate", "guidance_satisfaction"],
        intelligence_signal="personalization", model_category="controller", family="progression",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M43a", core_id="M43",
        model_name="What-If Tutor (Counterfactual Policy Explainer)",
        primary_function="Generate counterfactual 'what if you had done X instead' scenarios using causal policy explanation",
        what_it_adds=[
            "Generate counterfactual 'what if you had done X instead' scenarios in the Practice Sandbox.",
            "Uses causal policy explanation to surface actionable alternatives, not just outcomes.",
            "Never teaches optimal exploitation; focuses on principle, not mechanical edge.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "causal"],
        placement=["server"],
        budget="batch",
        primary_outputs=["counterfactual_scenarios", "causal_explanation", "principle_lesson", "exploitation_guard_passed"],
        eval_focus=["counterfactual_plausibility", "principle_lesson_clarity", "exploitation_guard_AUC"],
        intelligence_signal="personalization", model_category="predictor", family="progression",
        can_lock_off=True, priority=3, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M44a", core_id="M44",
        model_name="Starter Path Matchmaker (Archetype Routing + Anti-Boredom)",
        primary_function="Match new players to starter archetypes that fit their revealed decision style; prevent boredom via anti-repetition routing",
        what_it_adds=[
            "Match new players to starter archetypes that fit their revealed decision style.",
            "Anti-boredom routing: prevents starter path from feeling repetitive after first run.",
            "Feeds archetype analytics for game design.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["archetype_match", "boredom_risk_score", "anti_repetition_routing", "design_analytics_signal"],
        eval_focus=["archetype_retention_lift", "boredom_detection_AUC", "first_run_completion_rate"],
        intelligence_signal="personalization", model_category="recommender", family="progression",
        can_lock_off=True, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M45a", core_id="M45",
        model_name="Training Wheels Scheduler (Grace-Period Optimization)",
        primary_function="Optimize grace period duration and protection strength per player; remove training wheels at the right moment",
        what_it_adds=[
            "Optimize grace period duration and protection strength per player skill trajectory.",
            "Remove training wheels at the exact moment the player is ready — not too early, not too late.",
            "Detects grace period abuse: players deliberately staying in protection mode.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="batch",
        primary_outputs=["optimal_grace_duration", "removal_readiness_score", "abuse_flag", "protection_strength_delta"],
        eval_focus=["grace_removal_success_rate", "abuse_detection_AUC", "post_grace_retention"],
        intelligence_signal="churnRisk", model_category="controller", family="progression",
        can_lock_off=True, priority=2, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M46a", core_id="M46",
        model_name="Ledger Anomaly Detector (Event Stream Forensics)",
        primary_function="Detect anomalous ledger event sequences indicating state manipulation, replay injection, or clock abuse",
        what_it_adds=[
            "Detect anomalous ledger event sequences indicating state manipulation or replay injection.",
            "Clock abuse detection: events arriving out of causal order.",
            "Feeds Exploit Taxonomy (M49) with forensic evidence chains.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["anomaly_score", "manipulation_flag", "clock_abuse_flag", "forensic_evidence_chain"],
        eval_focus=["anomaly_detection_AUC", "clock_abuse_recall", "false_flag_rate"],
        intelligence_signal="antiCheat", model_category="anomaly_detector", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M47a", core_id="M47",
        model_name="Signature & Freshness Monitor (Client Action Integrity)",
        primary_function="Monitor client action signatures for staleness, replay attacks, and signature forgery patterns",
        what_it_adds=[
            "Monitor client action signatures for staleness, replay attacks, and forgery patterns.",
            "Detects coordinated signature spoofing across device clusters.",
            "Feeds Device Attestation (M71) trust tier scoring.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["signature_freshness_score", "replay_attack_flag", "forgery_probability", "device_cluster_anomaly"],
        eval_focus=["replay_detection_AUC", "forgery_recall", "false_flag_rate"],
        intelligence_signal="antiCheat", model_category="anomaly_detector", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M48a", core_id="M48",
        model_name="Replay Consistency Model (Deterministic Validator Assist)",
        primary_function="Assist deterministic validator by pre-scoring replay consistency; prioritize verification compute for suspicious runs",
        what_it_adds=[
            "Assist the deterministic validator by pre-scoring replay consistency.",
            "Prioritizes verification compute: high-risk runs get validated first.",
            "Reduces validator backlog by filtering obviously-clean runs.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["consistency_pre_score", "verification_priority", "clean_run_filter_passed", "backlog_reduction_delta"],
        eval_focus=["pre_score_calibration_ECE", "suspicious_recall", "validator_throughput_lift"],
        intelligence_signal="antiCheat", model_category="classifier", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M49a", core_id="M49",
        model_name="Exploit Response Policy (Auto-Containment Optimizer)",
        primary_function="Optimize exploit auto-containment response severity; minimize false positives while maintaining fast response",
        what_it_adds=[
            "Optimize exploit auto-containment response severity to minimize false positives.",
            "Learns exploit taxonomy drift: new exploit patterns get routed to containment faster.",
            "Outputs response policy with explicit caps and cooldowns.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["response_severity", "false_positive_risk", "taxonomy_update_signal", "containment_policy"],
        eval_focus=["false_positive_rate", "exploit_containment_speed", "taxonomy_drift_detection"],
        intelligence_signal="antiCheat", model_category="rl_policy", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M50a", core_id="M50",
        model_name="Proof Card Verifier (Receipt Hash Trust Layer)",
        primary_function="Score proof card authenticity using receipt hash validation and run-state consistency checks",
        what_it_adds=[
            "Score proof card authenticity using receipt hash validation and run-state consistency.",
            "Detects hash collisions, truncated proofs, and generated-without-play cards.",
            "Outputs trust tier for every proof card in the leaderboard pipeline.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["authenticity_score", "hash_collision_flag", "truncated_proof_flag", "trust_tier"],
        eval_focus=["authenticity_AUC", "collision_recall", "false_flag_rate"],
        intelligence_signal="antiCheat", model_category="classifier", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M51a", core_id="M51",
        model_name="Syndicate Coalition Scoring (Multi-Party Deal Stability)",
        primary_function="Score multi-party syndicate deal stability using coalition graph analysis; predict collapse before it fires",
        what_it_adds=[
            "Score multi-party syndicate deal stability using coalition graph analysis.",
            "Predict coalition collapse before it fires — allows proactive restructuring.",
            "Generates deal health receipts for arbitration.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["coalition_stability_score", "collapse_probability", "restructure_recommendation", "deal_health_receipt"],
        eval_focus=["stability_calibration_ECE", "collapse_AUC", "restructure_acceptance_rate"],
        intelligence_signal="risk", model_category="predictor", family="co_op",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M52a", core_id="M52",
        model_name="Escrow Milestone Success Model (Gaming-Resistant Release Gates)",
        primary_function="Score milestone achievement authenticity; detect gaming patterns in escrow release conditions",
        what_it_adds=[
            "Score milestone achievement authenticity against gaming patterns.",
            "Detects players engineering conditions for escrow release without genuine milestone completion.",
            "Feeds arbitration triage with milestone evidence.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["milestone_authenticity_score", "gaming_pattern_flag", "release_gate_recommendation", "arbitration_evidence"],
        eval_focus=["gaming_pattern_AUC", "milestone_authenticity_calibration", "false_gate_rate"],
        intelligence_signal="antiCheat", model_category="anomaly_detector", family="contract",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M53a", core_id="M53",
        model_name="Reliability & Collusion Monitor (Reputation Stake)",
        primary_function="Monitor partner reliability over time; detect collusion rings gaming reputation staking mechanics",
        what_it_adds=[
            "Monitor partner reliability trajectories using longitudinal ledger data.",
            "Detect collusion rings gaming reputation staking for guaranteed payouts.",
            "Outputs reputation adjustment recommendations with evidence.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="batch",
        primary_outputs=["reliability_trajectory", "collusion_ring_probability", "reputation_adjustment", "evidence_chain"],
        eval_focus=["collusion_AUC", "reliability_prediction_accuracy", "false_ring_rate"],
        intelligence_signal="antiCheat", model_category="anomaly_detector", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M54a", core_id="M54",
        model_name="Restructure Acceptance Forecaster (Distress Term Triage)",
        primary_function="Forecast restructure proposal acceptance probability; triage distress terms to maximize cooperative outcome",
        what_it_adds=[
            "Forecast restructure proposal acceptance probability given partner state and history.",
            "Triage distress terms to maximize cooperative resolution vs. adversarial default.",
            "Generates negotiation window recommendations.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["acceptance_probability", "distress_triage", "negotiation_window_recommendation", "cooperative_outcome_score"],
        eval_focus=["acceptance_calibration_ECE", "cooperative_resolution_rate", "distress_triage_accuracy"],
        intelligence_signal="recommendationPower", model_category="predictor", family="contract",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M55a", core_id="M55",
        model_name="Arbitration Triage + Verdict Summarizer (Replay Evidence)",
        primary_function="Triage arbitration disputes by evidence strength; summarize replay evidence for arbiters and players",
        what_it_adds=[
            "Triage arbitration disputes by evidence strength for expedited resolution.",
            "Summarize replay evidence into human-readable verdict summaries.",
            "Generates precedent links: similar cases from ledger history.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="batch",
        primary_outputs=["triage_priority", "evidence_summary", "verdict_recommendation", "precedent_links"],
        eval_focus=["triage_accuracy", "summary_clarity_rating", "resolution_speed_lift"],
        intelligence_signal="antiCheat", model_category="classifier", family="forensics",
        can_lock_off=True, priority=2, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M56a", core_id="M56",
        model_name="Doctrine Alignment Model (Playstyle Consistency + Hypocrisy Detector)",
        primary_function="Score doctrine consistency against player's actual decisions; detect hypocrisy patterns for Case File",
        what_it_adds=[
            "Score doctrine consistency against player's actual in-run decisions.",
            "Detect hypocrisy: players who claim a doctrine but consistently violate it.",
            "Feeds Case File with doctrine consistency timeline.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["doctrine_consistency_score", "hypocrisy_flag", "case_file_timeline", "cord_modifier_input"],
        eval_focus=["consistency_calibration", "hypocrisy_detection_AUC", "case_file_clarity"],
        intelligence_signal="personalization", model_category="classifier", family="forensics",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M57a", core_id="M57",
        model_name="Rebalancing Pulse Action Planner (Seconds-to-Save Router)",
        primary_function="Plan optimal rebalancing action sequence within the pulse window; maximize allocation improvement per second",
        what_it_adds=[
            "Plan optimal rebalancing action sequence within the pulse window.",
            "Maximizes allocation improvement per second of decision time.",
            "Flags impossible rebalance goals given remaining tick budget.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["client", "server"],
        budget="real_time",
        primary_outputs=["action_plan", "allocation_improvement_score", "impossible_goal_flag", "tick_budget_utilization"],
        eval_focus=["action_plan_optimality", "impossible_goal_precision", "tick_budget_efficiency"],
        intelligence_signal="momentum", model_category="rl_policy", family="market",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M58a", core_id="M58",
        model_name="Stress Test Selector (Risk/Reward Balancer + Anti-Farm)",
        primary_function="Select stress test parameters that maximize CORD yield and proof prestige without enabling farm exploitation",
        what_it_adds=[
            "Select stress test parameters that maximize CORD yield and proof prestige.",
            "Anti-farm guard: detects repeated easy stress test selection for reliable bonus farming.",
            "Generates stress test difficulty tiers for season design.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["stress_test_parameters", "farm_flag", "cord_yield_estimate", "difficulty_tier"],
        eval_focus=["cord_yield_calibration", "farm_detection_AUC", "proof_prestige_distribution"],
        intelligence_signal="antiCheat", model_category="recommender", family="balance",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M59a", core_id="M59",
        model_name="Complexity Heat Calibrator (Combo Degeneracy Detector)",
        primary_function="Calibrate complexity heat thresholds; detect degenerate combo stacks that break game balance",
        what_it_adds=[
            "Calibrate complexity heat thresholds per skill band and season.",
            "Detect degenerate combo stacks that produce overpowered or unreadable game states.",
            "Feeds Synergy Discovery Engine (M31a) with complexity degeneracy signals.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="batch",
        primary_outputs=["complexity_threshold_calibration", "degeneracy_flag", "synergy_signal", "balance_report"],
        eval_focus=["degeneracy_recall", "balance_impact_accuracy", "calibration_ECE"],
        intelligence_signal="volatility", model_category="anomaly_detector", family="balance",
        can_lock_off=True, priority=2, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M60a", core_id="M60",
        model_name="Liability Netting Advisor (Cascade Minimization Under Caps)",
        primary_function="Advise optimal liability netting sequence to minimize cascade risk while staying within exposure caps",
        what_it_adds=[
            "Advise optimal liability netting sequence to minimize cascade risk.",
            "Stays within exposure caps: netting recommendations never violate portfolio heat bounds.",
            "Generates cascade minimization receipts for Case File.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["client", "server"],
        budget="real_time",
        primary_outputs=["netting_sequence_recommendation", "cascade_minimization_score", "cap_compliance_verified", "receipt"],
        eval_focus=["cascade_reduction_rate", "cap_compliance_rate", "netting_optimality"],
        intelligence_signal="risk", model_category="recommender", family="market",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M61a", core_id="M61",
        model_name="Badge Tier Threshold Calibrator (Bronze→Platinum Distribution)",
        primary_function="Calibrate badge tier thresholds to maintain target distribution across skill bands without grade inflation",
        what_it_adds=[
            "Calibrate badge tier thresholds to maintain target grade distribution across skill bands.",
            "Prevents grade inflation: ensures Platinum remains genuinely prestigious.",
            "Generates season threshold recommendations with evidence.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="batch",
        primary_outputs=["threshold_recommendations", "distribution_delta", "inflation_flag", "prestige_score"],
        eval_focus=["distribution_stability", "inflation_detection_AUC", "prestige_calibration"],
        intelligence_signal="volatility", model_category="controller", family="economy",
        can_lock_off=True, priority=2, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M62a", core_id="M62",
        model_name="Team Contribution Estimator (Anti-Tagalong Credit Attribution)",
        primary_function="Estimate individual contribution in team runs; detect tagalong patterns to ensure fair badge attribution",
        what_it_adds=[
            "Estimate individual contribution in team runs using causal attribution.",
            "Detect tagalong patterns: players free-riding on teammates for shared achievements.",
            "Ensures fair badge attribution with explainable evidence.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="batch",
        primary_outputs=["contribution_estimate", "tagalong_probability", "attribution_receipt", "badge_eligibility_score"],
        eval_focus=["attribution_accuracy", "tagalong_detection_AUC", "badge_fairness_rating"],
        intelligence_signal="antiCheat", model_category="predictor", family="co_op",
        can_lock_off=True, priority=2, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M63a", core_id="M63",
        model_name="Sponsored Bounty Integrity Guard (Stake Escrow + Collusion Detection)",
        primary_function="Guard sponsored bounties against stake collusion and fake completion; verify winner legitimacy via ledger",
        what_it_adds=[
            "Guard sponsored bounties against stake collusion and fake completion.",
            "Verify winner legitimacy using ledger replay consistency.",
            "Detects sponsor-winner collusion rings.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["winner_legitimacy_score", "collusion_flag", "integrity_verified", "ledger_consistency_score"],
        eval_focus=["collusion_detection_AUC", "legitimacy_calibration_ECE", "false_flag_rate"],
        intelligence_signal="antiCheat", model_category="anomaly_detector", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M64a", core_id="M64",
        model_name="Leaderboard Trust & Re-Verify Scheduler (Proof-Weighted Rankings)",
        primary_function="Prioritize verification compute for high-impact leaderboard runs; compute trust scores gating competitive eligibility",
        what_it_adds=[
            "Prioritizes verification compute for high-impact runs (top ranks, suspicious deltas, new devices).",
            "Computes trust scores that gate markets/boards without blocking core play.",
            "Produces explainable 'why pending' and 'why re-verified' receipts for transparency.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["trust_score", "verification_priority", "pending_explanation", "reverify_receipt"],
        eval_focus=["trust_calibration_ECE", "verification_throughput", "false_pending_rate"],
        intelligence_signal="antiCheat", model_category="classifier", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M65a", core_id="M65",
        model_name="Variety Index Abuse Detector (Anti-Grind Curve Hardener)",
        primary_function="Detect variety index manipulation used to circumvent anti-grind trophy curves; harden decay curve against farming",
        what_it_adds=[
            "Detect variety index manipulation: players gaming the anti-grind system by artificially varying run patterns.",
            "Harden decay curve against sophisticated farming without penalizing genuine variety.",
            "Feeds Trophy Economy Balancer (M39a).",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="batch",
        primary_outputs=["manipulation_flag", "variety_authenticity_score", "curve_hardener_delta", "economy_signal"],
        eval_focus=["manipulation_AUC", "variety_authenticity_calibration", "economy_stability"],
        intelligence_signal="antiCheat", model_category="anomaly_detector", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M66a", core_id="M66",
        model_name="Mentor Matchmaker + Quality Guard (Guided Co-op Onboarding)",
        primary_function="Match mentors to new players by teaching style compatibility; guard mentor quality through outcome tracking",
        what_it_adds=[
            "Match mentors to new players by teaching style compatibility.",
            "Guard mentor quality: mentors with poor mentee outcomes lose queue priority.",
            "Detects mentor abuse: experienced players using mentoring for farming.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["mentor_match_score", "quality_score", "abuse_flag", "mentee_outcome_prediction"],
        eval_focus=["mentee_retention_lift", "quality_guard_AUC", "abuse_detection_precision"],
        intelligence_signal="personalization", model_category="recommender", family="co_op",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M67a", core_id="M67",
        model_name="UI Unlock Gatekeeper (Progressive Disclosure + Smurf Detection)",
        primary_function="Gate UI complexity unlocks to match player readiness; detect smurfs bypassing progressive disclosure",
        what_it_adds=[
            "Gate UI complexity unlocks to match genuine player readiness.",
            "Detect smurfs: experienced players on new accounts displaying advanced behavior patterns.",
            "Personalizes disclosure pacing without exposing power gaps.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["unlock_readiness_score", "smurf_probability", "disclosure_pace_recommendation", "power_gap_flag"],
        eval_focus=["unlock_readiness_calibration", "smurf_detection_AUC", "overwhelm_rate"],
        intelligence_signal="personalization", model_category="classifier", family="progression",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M68a", core_id="M68",
        model_name="Failure Rehab Scenario Generator (Death-Snapshot Curriculum)",
        primary_function="Generate targeted rehab scenarios from death snapshots using causal failure analysis; produce curriculum for identified weak spots",
        what_it_adds=[
            "Generate targeted rehab scenarios from death snapshot data using causal failure analysis.",
            "Produces a curriculum tailored to the specific weak spots that caused the wipe.",
            "Avoids re-traumatizing: scenarios are challenging but completion-rate-positive.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "causal"],
        placement=["server"],
        budget="batch",
        primary_outputs=["rehab_scenarios", "causal_weak_spot_map", "completion_rate_estimate", "curriculum_sequence"],
        eval_focus=["completion_rate", "skill_improvement_post_rehab", "retraumatization_rate"],
        intelligence_signal="personalization", model_category="generator", family="progression",
        can_lock_off=True, priority=3, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M69a", core_id="M69",
        model_name="Choice Drill Generator + Skill Rating (Micro-Sim Test Engine)",
        primary_function="Generate adaptive choice drills targeting player skill gaps; produce calibrated skill ratings from drill performance",
        what_it_adds=[
            "Generate adaptive choice drills targeting player skill gaps identified from run history.",
            "Produce calibrated skill ratings from drill performance without run outcome bias.",
            "Prevents drill gaming: adapts to recognize memorized patterns.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["drill_scenario", "skill_rating_update", "gaming_detection_flag", "gap_map"],
        eval_focus=["skill_rating_calibration", "gaming_detection_AUC", "skill_improvement_lift"],
        intelligence_signal="personalization", model_category="generator", family="progression",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M70a", core_id="M70",
        model_name="Co-op Bootcamp Orchestrator (Team Flow + Dropout Resilience)",
        primary_function="Orchestrate co-op bootcamp pacing for team flow; predict and prevent early dropout before it disrupts the session",
        what_it_adds=[
            "Orchestrate co-op bootcamp pacing to maximize team flow state.",
            "Predict early dropout probability and intervene before it disrupts the session.",
            "Feeds mentor matchmaker (M66a) with team compatibility signals.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["flow_pacing_signal", "dropout_probability", "intervention_recommendation", "team_compatibility_score"],
        eval_focus=["team_flow_rating", "dropout_prevention_AUC", "bootcamp_completion_rate"],
        intelligence_signal="churnRisk", model_category="controller", family="co_op",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M71a", core_id="M71",
        model_name="Device Trust Fusion Model (Attestation + Behavior + Network)",
        primary_function="Fuse device attestation signals, behavioral patterns, and network fingerprints into a single trust tier",
        what_it_adds=[
            "Fuse device attestation, behavioral patterns, and network fingerprints into a single trust tier.",
            "Detects attestation spoofing: correct certificates but anomalous behavior.",
            "Drives competitive eligibility gates without blocking casual play.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["device_trust_tier", "attestation_spoof_flag", "network_anomaly_score", "competitive_eligibility"],
        eval_focus=["trust_tier_accuracy", "spoof_detection_AUC", "false_block_rate"],
        intelligence_signal="antiCheat", model_category="embedding_model", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M72a", core_id="M72",
        model_name="Action Budget Anomaly Detector (Anti-Bot Pace Control)",
        primary_function="Detect bot-like action pacing patterns from action budget signals; distinguish bots from high-skill humans",
        what_it_adds=[
            "Detect bot-like action pacing from action budget signals.",
            "Distinguishes bots from high-skill humans: fast doesn't mean bot.",
            "Feeds Device Trust Fusion (M71a) with behavioral anomaly signals.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["bot_probability", "pacing_anomaly_score", "human_skill_estimate", "device_trust_signal"],
        eval_focus=["bot_detection_AUC", "human_false_positive_rate", "pacing_calibration"],
        intelligence_signal="antiCheat", model_category="anomaly_detector", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M73a", core_id="M73",
        model_name="Market Settlement Anomaly Model (2PC / Finality Dupe Detection)",
        primary_function="Detect settlement anomalies indicating duplication exploits, double-spend patterns, or 2PC race conditions",
        what_it_adds=[
            "Detect settlement anomalies indicating duplication exploits or double-spend patterns.",
            "Identifies 2PC race condition exploitation.",
            "Feeds market escrow finality pipeline with risk-scored transactions.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="real_time",
        primary_outputs=["settlement_anomaly_score", "dupe_probability", "race_condition_flag", "risk_scored_transaction"],
        eval_focus=["dupe_detection_AUC", "race_condition_recall", "false_block_rate"],
        intelligence_signal="antiCheat", model_category="anomaly_detector", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M74a", core_id="M74",
        model_name="Forensic Bundle Summarizer + Redactor (Truth Packets)",
        primary_function="Summarize forensic snapshot bundles into human-readable truth packets; apply privacy-safe redaction rules",
        what_it_adds=[
            "Summarize forensic snapshot bundles into human-readable truth packets.",
            "Apply privacy-safe redaction without destroying evidentiary value.",
            "Generates executive summary for support staff and external audit.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="batch",
        primary_outputs=["truth_packet_summary", "redacted_bundle", "evidentiary_value_score", "executive_summary"],
        eval_focus=["summary_accuracy", "redaction_privacy_audit", "evidentiary_value_preservation"],
        intelligence_signal="antiCheat", model_category="generator", family="forensics",
        can_lock_off=True, priority=2, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M75a", core_id="M75",
        model_name="Integrity Digest Generator (Privacy-Safe Transparency Audit)",
        primary_function="Generate season-level integrity digest from aggregated ledger data; publish without revealing individual run details",
        what_it_adds=[
            "Generate season-level integrity digest from aggregated ledger data.",
            "Publish audit trail without revealing individual player run details.",
            "Flags anomaly clusters for designer review without threshold leakage.",
        ],
        tiers=["baseline", "sequence_dl", "graph_dl", "policy_rl"],
        placement=["server"],
        budget="batch",
        primary_outputs=["integrity_digest", "anomaly_cluster_flags", "audit_trail", "privacy_compliance_score"],
        eval_focus=["digest_accuracy", "privacy_audit_pass", "anomaly_cluster_recall"],
        intelligence_signal="antiCheat", model_category="generator", family="forensics",
        can_lock_off=True, priority=2, training_phase=3,
    ),

    # ═══ PATTERN C+D: M76a–M150a · ML/DL Core schema ═════════════════════════

    MLMechanicMeta(
        ml_id="M76a", core_id="M76",
        model_name="Contract Voting Dynamics Model (Deadlock + Manipulation Detection)",
        primary_function="Model voting dynamics to predict deadlock probability and detect strategic vote manipulation",
        what_it_adds=["Predict voting deadlock probability and time-to-resolution.",
                      "Detect strategic manipulation: coordinated voting to block legitimate proposals.",
                      "Surfaces minority-view confidence for fairer decision outcomes."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["deadlock_probability", "manipulation_flag", "minority_confidence", "resolution_eta"],
        eval_focus=["deadlock_calibration_ECE", "manipulation_AUC", "resolution_speed_lift"],
        intelligence_signal="antiCheat", model_category="predictor", family="contract",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M77a", core_id="M77",
        model_name="Delegated Operator Oversight (Scope Compliance + Abuse Predictor)",
        primary_function="Monitor delegated operator actions for scope compliance; predict abuse before it damages the table",
        what_it_adds=["Monitor delegated operator actions for scope compliance in real time.",
                      "Predict operator abuse trajectories before damage occurs.",
                      "Generates delegation audit receipts."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["scope_compliance_score", "abuse_prediction", "delegation_receipt", "intervention_recommendation"],
        eval_focus=["scope_violation_recall", "abuse_prediction_AUC", "false_flag_rate"],
        intelligence_signal="antiCheat", model_category="anomaly_detector", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M78a", core_id="M78",
        model_name="Collateral Call Stress Forecaster (Top-Up Likelihood + Default Path)",
        primary_function="Forecast collateral call top-up likelihood and model default path probability under stress scenarios",
        what_it_adds=["Forecast collateral call top-up likelihood given partner portfolio state.",
                      "Model default path probability under macro stress scenarios.",
                      "Generates margin call timing recommendations."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["topup_probability", "default_path_score", "margin_call_timing", "stress_scenario_results"],
        eval_focus=["topup_calibration_ECE", "default_path_AUC", "timing_accuracy"],
        intelligence_signal="risk", model_category="predictor", family="co_op",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M79a", core_id="M79",
        model_name="Shared Objective Bond Success Model (Coordination + Sabotage Resistance)",
        primary_function="Score shared objective bond success probability; detect coordination failures and sabotage patterns",
        what_it_adds=["Score shared objective bond success probability from team coordination signals.",
                      "Detect coordination failures before they cascade into bond forfeit.",
                      "Sabotage resistance: identifies players undermining shared objectives."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["bond_success_probability", "coordination_failure_flag", "sabotage_flag", "intervention_window"],
        eval_focus=["success_calibration_ECE", "sabotage_AUC", "coordination_failure_recall"],
        intelligence_signal="antiCheat", model_category="predictor", family="co_op",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M80a", core_id="M80",
        model_name="Contract Receipt Card Generator (Proof Compression + Readability)",
        primary_function="Generate compressed, human-readable contract receipt cards with verified proof hashes",
        what_it_adds=["Generate compressed, human-readable contract receipt cards.",
                      "Extracts key decision moments and obligation fulfillments.",
                      "Produces shareable proof-hash-bound receipts."],
        tiers=["baseline", "sequence_dl"], placement=["server"], budget="batch",
        primary_outputs=["receipt_card", "compressed_summary", "key_decisions", "proof_hash_bound"],
        eval_focus=["readability_score", "compression_ratio", "hash_integrity_pass"],
        intelligence_signal="rewardFit", model_category="generator", family="contract",
        can_lock_off=True, priority=3, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M81a", core_id="M81",
        model_name="Synergy Tree Branch Recommender (Identity Routing + Non-Degenerate Paths)",
        primary_function="Recommend synergy tree branches that match player identity while filtering degenerate meta paths",
        what_it_adds=["Recommend synergy tree branches matching player identity and play style.",
                      "Filter degenerate meta paths that trivialize game balance.",
                      "Novelty injection: surfaces under-explored branches."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["client", "server"], budget="real_time",
        primary_outputs=["branch_recommendation", "degenerate_path_flag", "novelty_score", "identity_match"],
        eval_focus=["recommendation_acceptance_rate", "degenerate_path_recall", "identity_match_accuracy"],
        intelligence_signal="recommendationPower", model_category="recommender", family="balance",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M82a", core_id="M82",
        model_name="Timing Chain Recognizer (Sequence DL + Window Coach)",
        primary_function="Recognize timing chain setup sequences in real time; coach players on optimal window execution",
        what_it_adds=["Recognize timing chain setup sequences from tick-window patterns.",
                      "Coach on optimal window execution without revealing exact timing.",
                      "Detects chain abuse: mechanical scripting of timing sequences."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["client", "server"], budget="real_time",
        primary_outputs=["chain_recognition_signal", "window_coaching_hint", "abuse_flag", "execution_score"],
        eval_focus=["chain_recognition_AUC", "window_coaching_acceptance", "abuse_detection_precision"],
        intelligence_signal="momentum", model_category="classifier", family="market",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M83a", core_id="M83",
        model_name="Risk Parity Dial Optimizer (Constraint-Aware Exposure Rebalancer)",
        primary_function="Optimize risk parity dial settings for current exposure levels; suggest rebalance actions within constraint bounds",
        what_it_adds=["Optimize risk parity dial settings for current exposure state.",
                      "Suggest rebalance actions that stay within exposure cap constraints.",
                      "Flags unstable parity configurations under macro shock."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["client", "server"], budget="real_time",
        primary_outputs=["dial_optimization", "rebalance_suggestions", "instability_flag", "constraint_compliance"],
        eval_focus=["optimization_quality", "instability_recall", "constraint_compliance_rate"],
        intelligence_signal="risk", model_category="controller", family="market",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M84a", core_id="M84",
        model_name="Catalyst Pairing Compatibility Model (Bridge Safety + Degeneracy Watch)",
        primary_function="Score catalyst-synergy bridge compatibility; watch for degeneracy before catalyst slots enable game-breaking combos",
        what_it_adds=["Score catalyst-synergy bridge compatibility for safe cross-set bridging.",
                      "Pre-screen for degeneracy: catalyst pairs that collapse game balance.",
                      "Generates compatibility receipts for design review."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["compatibility_score", "degeneracy_flag", "design_review_receipt", "safe_bridge_recommendation"],
        eval_focus=["degeneracy_recall", "compatibility_calibration", "false_flag_rate"],
        intelligence_signal="volatility", model_category="predictor", family="balance",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M85a", core_id="M85",
        model_name="Mutation Draft Planner (Rewrite Selection + Collapse Risk Scorer)",
        primary_function="Plan mutation draft selection to maximize CORD upside while scoring collapse risk of each rewrite option",
        what_it_adds=["Plan mutation draft selection to maximize CORD upside.",
                      "Score collapse risk for each rewrite option before selection.",
                      "Flags rewrites that create unrecoverable portfolio fragility."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["client", "server"], budget="real_time",
        primary_outputs=["draft_plan", "collapse_risk_scores", "cord_upside_estimate", "fragility_flag"],
        eval_focus=["draft_plan_optimality", "collapse_risk_calibration_ECE", "fragility_recall"],
        intelligence_signal="alpha", model_category="rl_policy", family="market",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M86a", core_id="M86",
        model_name="Micro-Proof Moment Detector (Fine-Grain Highlight Miner)",
        primary_function="Mine micro-proof moments from tick-level event streams; stamp only genuinely exceptional micro-decisions",
        what_it_adds=["Mine micro-proof moments from tick-level event streams.",
                      "Stamp only genuinely exceptional micro-decisions — not routine play.",
                      "Feeds auto-clip packager with fine-grain highlight boundaries."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["client", "server"], budget="real_time",
        primary_outputs=["micro_proof_candidates", "exceptionality_score", "stamp_recommendation", "clip_boundary"],
        eval_focus=["micro_proof_precision", "exceptionality_calibration", "share_yield_lift"],
        intelligence_signal="rewardFit", model_category="classifier", family="social",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M87a", core_id="M87",
        model_name="Season Relic Mint Governor (Scarcity + Anti-Farm Control)",
        primary_function="Govern season relic minting to maintain scarcity and prestige; prevent farm-driven relic devaluation",
        what_it_adds=["Govern relic minting to maintain scarcity and prestige value.",
                      "Anti-farm control: detect and suppress farm-driven relic production.",
                      "Generates mint scarcity reports for season design."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="batch",
        primary_outputs=["mint_approval", "farm_flag", "scarcity_score", "prestige_projection"],
        eval_focus=["scarcity_maintenance", "farm_detection_AUC", "prestige_calibration"],
        intelligence_signal="volatility", model_category="controller", family="economy",
        can_lock_off=True, priority=3, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M88a", core_id="M88",
        model_name="Team Title Attribution Model (Contribution + Eligibility Verification)",
        primary_function="Verify team title eligibility from contribution evidence; detect tagalong attribution for shared team names",
        what_it_adds=["Verify team title eligibility from contribution evidence chains.",
                      "Detect tagalong attribution: players claiming shared titles without genuine contribution.",
                      "Generates contribution-weighted eligibility receipts."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="batch",
        primary_outputs=["eligibility_score", "tagalong_flag", "contribution_receipt", "title_grant_recommendation"],
        eval_focus=["eligibility_accuracy", "tagalong_AUC", "receipt_clarity"],
        intelligence_signal="antiCheat", model_category="predictor", family="co_op",
        can_lock_off=True, priority=2, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M89a", core_id="M89",
        model_name="Trust Multiplier Fairness Auditor (Integrity Incentives)",
        primary_function="Audit trust-weighted cosmetic multipliers for fairness; detect exploitable trust score gaming",
        what_it_adds=["Audit trust-weighted cosmetic multipliers for cross-skill-band fairness.",
                      "Detect trust score gaming: players artificially inflating trust for cosmetic multipliers.",
                      "Generates fairness audit receipts for season design."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="batch",
        primary_outputs=["fairness_audit_score", "gaming_flag", "multiplier_correction", "audit_receipt"],
        eval_focus=["fairness_drift_AUC", "gaming_detection_precision", "multiplier_calibration"],
        intelligence_signal="antiCheat", model_category="anomaly_detector", family="integrity",
        can_lock_off=True, priority=2, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M90a", core_id="M90",
        model_name="Salvage & Reroll Economy Stabilizer (Loop Detection + Sink Adequacy)",
        primary_function="Detect salvage/reroll loop exploitation; ensure sink adequacy prevents economy devaluation",
        what_it_adds=["Detect salvage/reroll loop exploitation before economy devaluation occurs.",
                      "Ensure sink adequacy: reroll output value stays within design bounds.",
                      "Generates economy stability reports."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="batch",
        primary_outputs=["loop_detection_flag", "sink_adequacy_score", "economy_delta", "stability_report"],
        eval_focus=["loop_detection_AUC", "sink_adequacy_KPI", "economy_stability_rate"],
        intelligence_signal="volatility", model_category="anomaly_detector", family="economy",
        can_lock_off=True, priority=2, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M91a", core_id="M91",
        model_name="First-Table Safety Model (Social Onboarding Abuse Preventer)",
        primary_function="Screen first-table social sessions for abuse risk; protect new players from toxicity before trust is established",
        what_it_adds=["Screen first-table social sessions for abuse risk before new players are exposed.",
                      "Detect inviter abuse: experienced players farming invite bonuses via exploitation.",
                      "Generates safe-session certification for first-table runs."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["abuse_risk_score", "inviter_farm_flag", "safe_session_certification", "protection_recommendation"],
        eval_focus=["abuse_detection_AUC", "farm_precision", "new_player_safety_rate"],
        intelligence_signal="antiCheat", model_category="anomaly_detector", family="social",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M92a", core_id="M92",
        model_name="Ghost Mentor Curation Engine (Best Replays + Overlay Quality)",
        primary_function="Curate ghost mentor replays for pedagogical quality; overlay decision annotations without revealing exploits",
        what_it_adds=["Curate ghost mentor replays for pedagogical quality and diversity.",
                      "Overlay decision annotations calibrated to learner's current skill level.",
                      "Anti-exploit filter: annotations teach principles, not mechanical edge."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="batch",
        primary_outputs=["curated_replay_set", "annotation_quality_score", "exploit_filter_passed", "skill_calibrated_overlay"],
        eval_focus=["pedagogical_quality_rating", "exploit_filter_AUC", "skill_improvement_lift"],
        intelligence_signal="personalization", model_category="recommender", family="progression",
        can_lock_off=True, priority=3, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M93a", core_id="M93",
        model_name="Loadout Lab Constraint Explainer (Preview Accuracy + CORD Estimator)",
        primary_function="Explain loadout constraint impact in plain language; provide accurate CORD premium estimates before run start",
        what_it_adds=["Explain loadout constraint impact in plain language before run start.",
                      "Provide accurate CORD premium estimates — players should never be surprised.",
                      "Detects mis-configured loadouts that produce degenerate constraint combinations."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["client", "server"], budget="real_time",
        primary_outputs=["constraint_explanation", "cord_premium_estimate", "degeneracy_flag", "misconfiguration_alert"],
        eval_focus=["explanation_clarity_score", "cord_estimate_accuracy", "degeneracy_recall"],
        intelligence_signal="recommendationPower", model_category="predictor", family="progression",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M94a", core_id="M94",
        model_name="Glossary Ping Relevance Model (Speak-Only-When-Needed)",
        primary_function="Score glossary ping relevance for the specific game state; enforce speak-only-when-needed minimalism",
        what_it_adds=["Score glossary ping relevance for the exact game state and player knowledge level.",
                      "Enforces minimalism: only ping when the term is genuinely unfamiliar AND currently relevant.",
                      "Learns individual vocabulary: stops pinging terms the player demonstrably knows."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["client"], budget="real_time",
        primary_outputs=["relevance_score", "familiar_term_flag", "ping_recommendation", "vocabulary_model_update"],
        eval_focus=["ping_precision", "annoyance_rate", "vocabulary_learning_accuracy"],
        intelligence_signal="personalization", model_category="classifier", family="progression",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M95a", core_id="M95",
        model_name="Wipe Clinic Causal Explainer (Minimal Counterfactual Generator)",
        primary_function="Generate minimal counterfactual explanations for wipe causes using causal inference; show what one change would have changed",
        what_it_adds=["Generate minimal counterfactual explanations: 'if you had done X at tick T, you survive.'",
                      "Uses causal inference to isolate the single highest-leverage pivot.",
                      "Never teaches exploitation; focuses on principle recovery paths."],
        tiers=["baseline", "sequence_dl", "causal"], placement=["server"], budget="batch",
        primary_outputs=["minimal_counterfactual", "leverage_pivot", "survival_probability_delta", "principle_recovery_path"],
        eval_focus=["counterfactual_plausibility", "leverage_pivot_accuracy", "exploitation_guard_AUC"],
        intelligence_signal="personalization", model_category="predictor", family="forensics",
        can_lock_off=True, priority=3, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M96a", core_id="M96",
        model_name="Time Drift & Lag Exploit Classifier (Server-Time Authority Guard)",
        primary_function="Classify time drift patterns as genuine network lag vs. deliberate time manipulation exploits",
        what_it_adds=["Classify time drift patterns: genuine network lag vs. deliberate time manipulation.",
                      "Learns device + network fingerprints to reduce false positives on laggy connections.",
                      "Feeds Device Trust Fusion (M71a) with time-exploit signals."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["drift_classification", "exploit_probability", "lag_legitimacy_score", "device_trust_signal"],
        eval_focus=["exploit_AUC", "lag_false_positive_rate", "drift_calibration"],
        intelligence_signal="antiCheat", model_category="classifier", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M97a", core_id="M97",
        model_name="Seed Commit/Reveal Verifier (RNG Integrity + Bias Monitor)",
        primary_function="Verify commit/reveal RNG integrity; detect bias in seed generation patterns indicating predetermination",
        what_it_adds=["Verify commit/reveal RNG integrity across the full seed lifecycle.",
                      "Detect bias in seed generation patterns indicating predetermination or server-side manipulation.",
                      "Feeds Replay Forensics (M01a) with RNG integrity signals."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["rng_integrity_score", "bias_detection_flag", "predetermination_probability", "forensic_signal"],
        eval_focus=["bias_detection_AUC", "rng_integrity_calibration", "false_flag_rate"],
        intelligence_signal="antiCheat", model_category="anomaly_detector", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M98a", core_id="M98",
        model_name="Quarantine Compute Scheduler (Fast-Path Clean Runs, Deep-Path Suspicious)",
        primary_function="Schedule quarantine compute allocation: fast-path clearly clean runs, deep-check suspicious runs with minimal player disruption",
        what_it_adds=["Schedule quarantine compute: fast-path clean runs, deep-check suspicious runs.",
                      "Minimizes player disruption: clean runs never feel delayed.",
                      "Adaptive prioritization: emerging exploit patterns trigger dynamic queue reweighting."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["compute_schedule", "fast_path_flag", "deep_check_priority", "queue_reweighting_signal"],
        eval_focus=["throughput_SLO", "false_fast_path_rate", "exploit_detection_speed"],
        intelligence_signal="antiCheat", model_category="controller", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M99a", core_id="M99",
        model_name="Integrity Challenge Placement Optimizer (Non-Disruptive + High-Signal)",
        primary_function="Optimize placement and timing of integrity challenges to maximize signal value without disrupting legitimate play",
        what_it_adds=["Optimize challenge placement and timing for maximum signal yield.",
                      "Non-disruptive: challenges feel like natural game moments, not security checks.",
                      "Adapts challenge difficulty to current device trust tier."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["challenge_placement", "signal_yield_estimate", "disruption_score", "difficulty_tier"],
        eval_focus=["signal_yield_AUC", "disruption_rate", "placement_calibration"],
        intelligence_signal="antiCheat", model_category="controller", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M100a", core_id="M100",
        model_name="Appeal Triage & Evidence Chain Checker (Verifiable Enforcement)",
        primary_function="Triage enforcement appeals by evidence strength; verify evidence chains are complete and tamper-evident before arbitration",
        what_it_adds=["Triage enforcement appeals by evidence strength for expedited resolution.",
                      "Verify evidence chains are complete, ordered, and tamper-evident.",
                      "Generates triage receipts for transparency."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="batch",
        primary_outputs=["triage_score", "evidence_chain_integrity", "tamper_flag", "triage_receipt"],
        eval_focus=["triage_accuracy", "evidence_integrity_AUC", "resolution_speed_lift"],
        intelligence_signal="antiCheat", model_category="classifier", family="forensics",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M101a", core_id="M101",
        model_name="Mutator Draft Recommender + Balance Forecaster",
        primary_function="Recommend mutator combinations that maximize run variety and drama; forecast balance impact before activation",
        what_it_adds=["Recommend mutator combinations that maximize run variety and personal challenge.",
                      "Forecast balance impact before activation: no mutators that trivialize or destroy.",
                      "Personalize mutator suggestions to player's revealed blind spots."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["mutator_recommendation", "balance_forecast", "blind_spot_targeting", "trivialize_flag"],
        eval_focus=["recommendation_acceptance_rate", "balance_forecast_accuracy", "run_variety_index"],
        intelligence_signal="recommendationPower", model_category="recommender", family="balance",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M102a", core_id="M102",
        model_name="Forked Timeline Ghost Outcome Generator",
        primary_function="Generate plausible ghost outcomes for both timeline branches; surface decision quality comparison without hinting at optimal play",
        what_it_adds=["Generate plausible ghost outcomes for both timeline branches.",
                      "Surface decision quality comparison without hinting at mechanically optimal play.",
                      "Feeds Case File with branching outcome analysis."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="batch",
        primary_outputs=["ghost_outcome_branch_a", "ghost_outcome_branch_b", "decision_quality_delta", "case_file_signal"],
        eval_focus=["outcome_plausibility", "decision_quality_calibration", "exploit_guard_AUC"],
        intelligence_signal="alpha", model_category="generator", family="forensics",
        can_lock_off=True, priority=3, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M103a", core_id="M103",
        model_name="Emergency Liquidity Panic Button Coach",
        primary_function="Coach emergency liquidity decisions under extreme time pressure; rank sell options by recovery probability",
        what_it_adds=["Coach emergency liquidity decisions under extreme time pressure.",
                      "Rank sell options by recovery probability, not just immediate cash yield.",
                      "Panic detection: flags decision paralysis before the window closes."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["client", "server"], budget="real_time",
        primary_outputs=["sell_rank_by_recovery", "paralysis_flag", "recovery_probability", "window_expiry_warning"],
        eval_focus=["recovery_rank_accuracy", "paralysis_detection_AUC", "window_utilization_rate"],
        intelligence_signal="momentum", model_category="recommender", family="market",
        can_lock_off=True, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M104a", core_id="M104",
        model_name="Deal Scarcity Anticipation Model",
        primary_function="Anticipate deal scarcity transitions before they occur; signal players to act before SCARCITY state locks them out",
        what_it_adds=["Anticipate deal scarcity transitions before they lock the market.",
                      "Signal players to act within their opportunity window — not after.",
                      "Tracks deck composition to forecast exhaustion timing."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["client", "server"], budget="real_time",
        primary_outputs=["scarcity_transition_eta", "deck_exhaustion_forecast", "act_now_signal", "opportunity_window_estimate"],
        eval_focus=["scarcity_prediction_AUC", "signal_timing_accuracy", "false_urgency_rate"],
        intelligence_signal="alpha", model_category="predictor", family="market",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M105a", core_id="M105",
        model_name="Last Look Window Misclick Guard + Regret Amplifier",
        primary_function="Detect likely misclick in last-look window; amplify regret signal for post-mortem when a misclick costs the run",
        what_it_adds=["Detect likely misclicks in the last-look window before they become irreversible.",
                      "Amplify regret signal in post-mortem: 'you misclicked here' with tick evidence.",
                      "Generates misclick guard receipts for support appeals."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["client"], budget="real_time",
        primary_outputs=["misclick_probability", "regret_amplification_signal", "guard_receipt", "support_evidence"],
        eval_focus=["misclick_detection_AUC", "false_guard_rate", "regret_signal_precision"],
        intelligence_signal="personalization", model_category="classifier", family="balance",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M106a", core_id="M106",
        model_name="Asset Condition Failure Predictor + Maintenance Planner",
        primary_function="Predict asset condition failure timing using causal wear models; generate maintenance plans to prevent cascade failure",
        what_it_adds=["Predict asset condition failure timing from wear pattern data.",
                      "Generate maintenance plans that prevent cascade failure without over-maintaining.",
                      "Causal model: distinguishes genuine wear from macro-shock damage."],
        tiers=["baseline", "sequence_dl", "causal"], placement=["client", "server"], budget="real_time",
        primary_outputs=["failure_prediction_timeline", "maintenance_plan", "cascade_prevention_score", "causal_wear_estimate"],
        eval_focus=["failure_timing_AUC", "maintenance_plan_optimality", "cascade_prevention_rate"],
        intelligence_signal="risk", model_category="predictor", family="market",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M107a", core_id="M107",
        model_name="Refi Eligibility Estimator + Term Optimizer",
        primary_function="Estimate refi eligibility probability under current macro conditions; optimize term selection for best net cashflow outcome",
        what_it_adds=["Estimate refi eligibility probability under current macro conditions.",
                      "Optimize term selection for best net cashflow outcome without debt-trap risk.",
                      "Surfaces refi window timing recommendations."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["client", "server"], budget="real_time",
        primary_outputs=["eligibility_probability", "optimized_terms", "debt_trap_risk", "window_timing"],
        eval_focus=["eligibility_calibration_ECE", "term_optimization_quality", "debt_trap_recall"],
        intelligence_signal="alpha", model_category="predictor", family="market",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M108a", core_id="M108",
        model_name="Partial Fill Probability + Timing Tutor",
        primary_function="Estimate partial fill probability for deal requests; tutor players on timing decisions to maximize fill rate",
        what_it_adds=["Estimate partial fill probability for deal requests given current market state.",
                      "Tutor timing decisions: earlier often fills more, but context matters.",
                      "Surfaces fill timing windows for player UI."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["client", "server"], budget="real_time",
        primary_outputs=["fill_probability", "timing_recommendation", "fill_window_estimate", "tutor_hint"],
        eval_focus=["fill_probability_calibration_ECE", "timing_recommendation_AUC", "fill_rate_lift"],
        intelligence_signal="alpha", model_category="predictor", family="market",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M109a", core_id="M109",
        model_name="Macro News Burst Impact Synth + Regime Detector",
        primary_function="Synthesize macro news burst impact on portfolio; detect regime transitions embedded in headline sequences",
        what_it_adds=["Synthesize macro news burst impact on portfolio state in real time.",
                      "Detect regime transitions embedded in headline sequences before M05 fires.",
                      "Generates narrative-driven macro summaries for Pressure Journal."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["impact_synthesis", "regime_transition_signal", "portfolio_delta_forecast", "narrative_summary"],
        eval_focus=["regime_detection_lead_time", "impact_synthesis_accuracy", "narrative_clarity"],
        intelligence_signal="volatility", model_category="predictor", family="market",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M110a", core_id="M110",
        model_name="UI Stall Predictor + Auto-Default Guard",
        primary_function="Predict UI stalls before they occur from session load signals; activate auto-default guard to prevent silent timer expiry",
        what_it_adds=["Predict UI stalls from session load and device signals before they occur.",
                      "Activate auto-default guard: if stall is predicted, pre-queue a safe default action.",
                      "Stall forensics: logs stall events for anti-abuse pipeline."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["client", "server"], budget="real_time",
        primary_outputs=["stall_probability", "auto_default_action", "stall_forensic_log", "guard_activation_flag"],
        eval_focus=["stall_prediction_AUC", "auto_default_appropriateness", "stall_forensic_integrity"],
        intelligence_signal="antiCheat", model_category="predictor", family="integrity",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M111a", core_id="M111",
        model_name="Portfolio Macro Synth + Safety Verifier",
        primary_function="Synthesize portfolio macro rule interactions; verify combined macro safety before activation to prevent runaway autopilot",
        what_it_adds=["Synthesize portfolio macro rule interactions for combined safety verification.",
                      "Prevent runaway autopilot: combined macros never exceed hard action caps.",
                      "Generates macro interaction receipts for audit."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["interaction_synthesis", "safety_verification", "cap_compliance_flag", "macro_receipt"],
        eval_focus=["interaction_detection_accuracy", "safety_verification_recall", "cap_compliance_rate"],
        intelligence_signal="risk", model_category="controller", family="market",
        can_lock_off=True, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M112a", core_id="M112",
        model_name="Optimal Split Estimator (Precision Sell Coach)",
        primary_function="Estimate optimal sell split ratio for maximum recovery probability; coach precision split decisions under time pressure",
        what_it_adds=["Estimate optimal sell split ratio for maximum recovery probability.",
                      "Coach precision split decisions under time pressure without prescribing exact amounts.",
                      "Counterfactual: 'if you had split 40/60 instead...' in post-mortem."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["client", "server"], budget="real_time",
        primary_outputs=["optimal_split_ratio", "recovery_probability", "coaching_hint", "counterfactual_signal"],
        eval_focus=["split_optimality_accuracy", "recovery_calibration_ECE", "coaching_acceptance_rate"],
        intelligence_signal="alpha", model_category="recommender", family="market",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M113a", core_id="M113",
        model_name="Order Priority Stack Sacrifice Planner (Graph-Aware)",
        primary_function="Plan sacrifice order to minimize cascade loss using portfolio dependency graph; surface highest-leverage protection choices",
        what_it_adds=["Plan sacrifice order to minimize cascade loss using portfolio dependency graph analysis.",
                      "Surface highest-leverage protection choices under incoming damage.",
                      "Generates sacrifice plan receipts for Case File."],
        tiers=["baseline", "sequence_dl", "graph_dl"], placement=["client", "server"], budget="real_time",
        primary_outputs=["sacrifice_order_plan", "cascade_minimization_score", "protection_priority", "case_file_receipt"],
        eval_focus=["sacrifice_plan_optimality", "cascade_minimization_AUC", "protection_accuracy"],
        intelligence_signal="momentum", model_category="rl_policy", family="market",
        can_lock_off=True, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M114a", core_id="M114",
        model_name="Timing Tax Reaction-Time Coach + Window Predictor",
        primary_function="Coach decision reaction time to maximize timing tax bonuses; predict upcoming decision windows for preparation",
        what_it_adds=["Coach decision reaction time to maximize timing tax bonuses.",
                      "Predict upcoming decision windows so players can prepare.",
                      "Distinguishes deliberate slow play from genuine hesitation."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["client"], budget="real_time",
        primary_outputs=["reaction_time_coaching", "window_prediction", "deliberate_vs_hesitation", "timing_tax_estimate"],
        eval_focus=["window_prediction_accuracy", "coaching_lift", "hesitation_classification_AUC"],
        intelligence_signal="momentum", model_category="classifier", family="balance",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M115a", core_id="M115",
        model_name="Heat-Swap Exposure Rebalancer Suggestion",
        primary_function="Suggest heat-swap targets that rebalance exposure without reducing net risk; flag swaps that create hidden concentration",
        what_it_adds=["Suggest heat-swap targets that rebalance exposure distribution.",
                      "Flag swaps that create hidden concentration risk while appearing balanced.",
                      "Generates exposure map before and after swap for player visualization."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["client", "server"], budget="real_time",
        primary_outputs=["swap_target_suggestion", "hidden_concentration_flag", "exposure_map_before", "exposure_map_after"],
        eval_focus=["rebalance_quality", "concentration_detection_AUC", "suggestion_acceptance_rate"],
        intelligence_signal="risk", model_category="recommender", family="market",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M116a", core_id="M116",
        model_name="Table Role Fit Matcher + Conflict Predictor",
        primary_function="Match players to table roles by revealed play style; predict role conflict before it degrades team performance",
        what_it_adds=["Match players to table roles by revealed play style and behavioral history.",
                      "Predict role conflict: duplicate energy types cause real coordination failures.",
                      "Generates role fit receipts for team formation."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["role_fit_score", "conflict_prediction", "role_receipt", "synergy_bonus_estimate"],
        eval_focus=["role_fit_calibration", "conflict_prediction_AUC", "synergy_bonus_accuracy"],
        intelligence_signal="personalization", model_category="recommender", family="co_op",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M117a", core_id="M117",
        model_name="Table Feed Moment Ranker + Auto-Highlight Builder",
        primary_function="Rank run moments by social relevance for the table feed; auto-build highlight reels from ranked moments",
        what_it_adds=["Rank run moments by social relevance for the table feed.",
                      "Auto-build highlight reels from ranked moments without reproducing full run data.",
                      "Privacy-safe: ranks only consented, in-session moments."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="batch",
        primary_outputs=["moment_rankings", "highlight_reel", "relevance_scores", "privacy_compliance"],
        eval_focus=["relevance_ranking_AUC", "highlight_engagement_rate", "privacy_audit_pass"],
        intelligence_signal="rewardFit", model_category="recommender", family="social",
        can_lock_off=True, priority=2, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M118a", core_id="M118",
        model_name="Clip Remix Chain Suggestor + Safety Filter",
        primary_function="Suggest remix chain targets from verified clip graph; filter remixes for consent, copyright, and toxicity safety",
        what_it_adds=["Suggest remix chain targets from the verified clip graph.",
                      "Filter remixes for consent, copyright, and toxicity before publishing.",
                      "Generates remix chain integrity receipts."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="batch",
        primary_outputs=["remix_suggestions", "safety_filter_result", "chain_integrity_receipt", "consent_verified"],
        eval_focus=["remix_acceptance_rate", "safety_filter_AUC", "consent_compliance_rate"],
        intelligence_signal="rewardFit", model_category="classifier", family="social",
        can_lock_off=True, priority=3, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M119a", core_id="M119",
        model_name="Rivalry Ledger Nemesis Arc Detector",
        primary_function="Detect emerging nemesis arcs from rivalry ledger patterns; surface rivalry narrative moments for sharing",
        what_it_adds=["Detect emerging nemesis arcs from rivalry ledger patterns.",
                      "Surface rivalry narrative moments: 'third consecutive loss to same opponent' becomes a shareable arc.",
                      "Generates rivalry arc summaries for social feed."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="batch",
        primary_outputs=["nemesis_arc_detection", "narrative_moments", "arc_summary", "share_prompt"],
        eval_focus=["arc_detection_AUC", "narrative_moment_yield", "share_rate"],
        intelligence_signal="rewardFit", model_category="classifier", family="social",
        can_lock_off=True, priority=3, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M120a", core_id="M120",
        model_name="Consent Gate Chaos Mode Recommender",
        primary_function="Recommend which chaos social tokens are appropriate to offer given both players' consent profiles and play history",
        what_it_adds=["Recommend which chaos tokens are appropriate to offer given consent profiles.",
                      "Never suggests tokens the target player has rejected previously.",
                      "Generates consent-aware chaos recommendations."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["appropriate_token_set", "rejection_filter_applied", "consent_recommendation", "chaos_impact_estimate"],
        eval_focus=["consent_compliance_rate", "token_acceptance_rate", "chaos_impact_accuracy"],
        intelligence_signal="rewardFit", model_category="recommender", family="social",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M121a", core_id="M121",
        model_name="Daily Gauntlet Leaderboard Integrity Monitor",
        primary_function="Monitor daily gauntlet leaderboard for coordinated score manipulation and seed exploitation patterns",
        what_it_adds=["Monitor daily gauntlet leaderboard for coordinated score manipulation.",
                      "Detect seed exploitation: players sharing optimal move sequences for unfair advantage.",
                      "Generates daily integrity digest."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["manipulation_flag", "seed_exploit_detection", "daily_integrity_digest", "leaderboard_trust_score"],
        eval_focus=["manipulation_AUC", "seed_exploit_recall", "false_flag_rate"],
        intelligence_signal="antiCheat", model_category="anomaly_detector", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M122a", core_id="M122",
        model_name="Weekly Draft League Advisor + Draft Order Fairness",
        primary_function="Advise draft picks based on player's revealed preferences; verify draft order fairness against snake-draft rules",
        what_it_adds=["Advise draft picks based on player's revealed module preferences and run history.",
                      "Verify draft order fairness: detect advantage-seeking in snake draft manipulation.",
                      "Generates draft receipt for post-league review."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["draft_advice", "fairness_verification", "manipulation_flag", "draft_receipt"],
        eval_focus=["draft_acceptance_rate", "fairness_AUC", "manipulation_recall"],
        intelligence_signal="recommendationPower", model_category="recommender", family="balance",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M123a", core_id="M123",
        model_name="King-of-the-Hill Streak Story Arc Narrator",
        primary_function="Narrate king-of-the-hill streak arcs for social sharing; generate stake rotation fairness signals",
        what_it_adds=["Narrate king-of-the-hill streak arcs as shareable social stories.",
                      "Generate stake rotation fairness signals: stakes never become prohibitively punishing.",
                      "Streak legitimacy: verify consecutive wins against collusion patterns."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="batch",
        primary_outputs=["streak_narrative", "stake_fairness_signal", "legitimacy_score", "share_prompt"],
        eval_focus=["narrative_quality_rating", "stake_fairness_calibration", "legitimacy_AUC"],
        intelligence_signal="rewardFit", model_category="generator", family="social",
        can_lock_off=True, priority=3, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M124a", core_id="M124",
        model_name="Speedrun Micro-Coach + Split Timer Optimizer",
        primary_function="Micro-coach speedrun decision pacing; optimize split timer targets based on player's revealed capability trajectory",
        what_it_adds=["Micro-coach speedrun decision pacing between split points.",
                      "Optimize split timer targets based on player's revealed capability, not median population.",
                      "Detects speedrun farming: deliberately slow runs to manipulate ranking brackets."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["client", "server"], budget="real_time",
        primary_outputs=["pacing_coaching", "split_target_optimization", "farming_flag", "capability_trajectory"],
        eval_focus=["split_optimization_accuracy", "farming_detection_AUC", "coaching_acceptance_rate"],
        intelligence_signal="personalization", model_category="controller", family="balance",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M125a", core_id="M125",
        model_name="No-Ghost Hardcore Integrity Verifier",
        primary_function="Verify no-ghost hardcore runs for ghost-disabling compliance; detect ghost data residue in hardcore states",
        what_it_adds=["Verify no-ghost hardcore runs for ghost-disabling compliance.",
                      "Detect ghost data residue: players using cached ghost signals in hardcore mode.",
                      "Generates hardcore legitimacy receipts for leaderboard eligibility."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["ghost_compliance_score", "residue_detection_flag", "legitimacy_receipt", "leaderboard_eligibility"],
        eval_focus=["compliance_AUC", "residue_detection_recall", "false_flag_rate"],
        intelligence_signal="antiCheat", model_category="classifier", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M126a", core_id="M126",
        model_name="Cosmetic Loadout Style Recommender + Auto-Set Builder",
        primary_function="Recommend cosmetic loadouts matching player's proof-card history and identity; auto-build sets from available inventory",
        what_it_adds=["Recommend cosmetic loadouts that match player's proof-card history and expressed identity.",
                      "Auto-build sets from available inventory: maximize visual coherence.",
                      "Never surface pay-gated cosmetics as 'recommended' without explicit unlock path shown."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["client"], budget="batch",
        primary_outputs=["loadout_recommendation", "auto_built_set", "identity_match_score", "p2w_guard_passed"],
        eval_focus=["recommendation_acceptance_rate", "identity_match_accuracy", "p2w_guard_pass_rate"],
        intelligence_signal="recommendationPower", model_category="recommender", family="progression",
        can_lock_off=True, priority=3, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M127a", core_id="M127",
        model_name="Proof-Bound Crafting Recipe Discoverer + Legibility Scorer",
        primary_function="Discover crafting recipe combinations from verified fragment graph; score recipe legibility before surfacing to player",
        what_it_adds=["Discover crafting recipe combinations from the verified fragment graph.",
                      "Score recipe legibility: players should understand why a recipe works.",
                      "Anti-exploit: flags recipes that produce disproportionate economy impact."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="batch",
        primary_outputs=["recipe_discoveries", "legibility_score", "economy_impact_flag", "recipe_recommendation"],
        eval_focus=["recipe_discovery_recall", "legibility_rating", "economy_impact_AUC"],
        intelligence_signal="recommendationPower", model_category="recommender", family="economy",
        can_lock_off=True, priority=3, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M128a", core_id="M128",
        model_name="Season Sink Health Monitor + Burn Rate Optimizer",
        primary_function="Monitor season sink health metrics; optimize burn rate recommendations to prevent economy devaluation",
        what_it_adds=["Monitor season sink health metrics: inflow vs. outflow balance.",
                      "Optimize burn rate recommendations to prevent currency devaluation.",
                      "Generates sink health digest for season design team."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="batch",
        primary_outputs=["sink_health_score", "burn_rate_recommendation", "devaluation_risk", "design_digest"],
        eval_focus=["sink_health_stability", "devaluation_prediction_AUC", "burn_rate_calibration"],
        intelligence_signal="volatility", model_category="controller", family="economy",
        can_lock_off=True, priority=2, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M129a", core_id="M129",
        model_name="Creator Pack Caption Generator + Moment Stinger Selector",
        primary_function="Generate contextually accurate captions for creator pack moments; select optimal sound stingers for emotional beat matching",
        what_it_adds=["Generate contextually accurate captions for creator pack moments.",
                      "Select optimal sound stingers for emotional beat matching to the moment type.",
                      "Safety filter: captions never contain sensitive thresholds or exploitable information."],
        tiers=["baseline", "sequence_dl"], placement=["client", "server"], budget="real_time",
        primary_outputs=["caption_text", "stinger_selection", "safety_filter_passed", "beat_match_score"],
        eval_focus=["caption_accuracy", "stinger_appropriateness", "safety_filter_AUC"],
        intelligence_signal="rewardFit", model_category="generator", family="social",
        can_lock_off=True, priority=3, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M130a", core_id="M130",
        model_name="Table Vault Contribution Planner + Fairness Auditor",
        primary_function="Plan optimal vault contribution strategies for team members; audit vault usage for free-rider patterns",
        what_it_adds=["Plan optimal vault contribution strategies based on team treasury state.",
                      "Audit vault usage for free-rider patterns: members using vault without contributing.",
                      "Generates contribution fairness receipts."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="batch",
        primary_outputs=["contribution_plan", "free_rider_flag", "fairness_receipt", "vault_optimization_score"],
        eval_focus=["contribution_plan_acceptance", "free_rider_AUC", "fairness_calibration"],
        intelligence_signal="antiCheat", model_category="predictor", family="co_op",
        can_lock_off=True, priority=2, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M131a", core_id="M131",
        model_name="Faction Sponsor Match + Power Guard",
        primary_function="Match players to faction sponsors by revealed identity and run style; verify no power advantage crosses the flavor boundary",
        what_it_adds=["Match players to faction sponsors that align with their revealed identity and run style.",
                      "Power guard: faction benefits never exceed cosmetic + narrative scope.",
                      "Generates faction match receipts for transparency."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="batch",
        primary_outputs=["sponsor_match", "power_guard_verified", "faction_receipt", "identity_alignment_score"],
        eval_focus=["sponsor_match_acceptance", "power_guard_AUC", "identity_alignment_accuracy"],
        intelligence_signal="personalization", model_category="recommender", family="social",
        can_lock_off=True, priority=3, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M132a", core_id="M132",
        model_name="Case Files Forensic Summarizer + Root-Cause Ranker",
        primary_function="Auto-write wipe/close-call dossiers using causal inference; rank highest-leverage pivots the player missed",
        what_it_adds=["Auto-write wipe/close-call dossier with timeline and top causal chain.",
                      "Rank 1–2 highest-leverage pivots you missed (non-exploit).",
                      "Builds a season-wide forensic library for replay training."],
        tiers=["baseline", "causal", "retrieval"], placement=["server"], budget="batch",
        primary_outputs=["case_file_dossier", "pivot_ranking", "causal_chain", "season_library_entry"],
        eval_focus=["dossier_accuracy", "pivot_ranking_precision", "causal_chain_validity"],
        intelligence_signal="personalization", model_category="predictor", family="forensics",
        can_lock_off=True, priority=2, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M133a", core_id="M133",
        model_name="Seasonal Story Beat Planner + Narrative Coherence Guard",
        primary_function="Plan seasonal story beats for maximum emotional impact; guard narrative coherence against contradictory beat sequences",
        what_it_adds=["Plan seasonal story beats for maximum emotional impact across the season arc.",
                      "Guard narrative coherence: beats never contradict each other or previous season lore.",
                      "Generates beat schedule recommendations for season design."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="batch",
        primary_outputs=["beat_schedule", "coherence_score", "contradiction_flag", "emotional_arc_quality"],
        eval_focus=["beat_engagement_rate", "coherence_accuracy", "contradiction_recall"],
        intelligence_signal="rewardFit", model_category="generator", family="social",
        can_lock_off=True, priority=3, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M134a", core_id="M134",
        model_name="NPC Counterparty Behavioral Emulator (Deterministic Persona Fidelity)",
        primary_function="Emulate NPC counterparty personas with high behavioral fidelity while maintaining full determinism from run seed",
        what_it_adds=["Emulate NPC counterparty personas with high behavioral fidelity.",
                      "Maintain full determinism: same seed produces identical NPC behavior.",
                      "Persona drift detection: NPC behavior never drifts outside defined character bounds."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["persona_behavior_output", "determinism_verification", "drift_flag", "character_fidelity_score"],
        eval_focus=["behavioral_fidelity_accuracy", "determinism_verification_pass", "drift_detection_AUC"],
        intelligence_signal="personalization", model_category="controller", family="market",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M135a", core_id="M135",
        model_name="Reputation Label Model + Drift Detector",
        primary_function="Assign proof-based reputation labels from run history; detect label drift when player behavior changes legitimately",
        what_it_adds=["Assign proof-based reputation labels from verified run history.",
                      "Detect label drift: legitimate behavior change should update labels, not freeze them.",
                      "Reversibility engine: bad labels clear when behavior improves."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="batch",
        primary_outputs=["label_assignment", "drift_signal", "reversibility_score", "evidence_receipt"],
        eval_focus=["label_accuracy", "drift_detection_AUC", "reversibility_rate"],
        intelligence_signal="personalization", model_category="classifier", family="forensics",
        can_lock_off=True, priority=2, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M136a", core_id="M136",
        model_name="Ruleset Signature Verifier + Change Impact Estimator",
        primary_function="Verify ruleset signature authenticity; estimate player impact of ruleset changes before deployment",
        what_it_adds=["Verify ruleset signature authenticity at run start and mid-run.",
                      "Estimate player impact of ruleset changes before deployment.",
                      "Generates change impact digest for season communication."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["signature_verification", "change_impact_estimate", "player_communication_digest", "deployment_risk"],
        eval_focus=["signature_verification_accuracy", "impact_estimate_calibration", "deployment_risk_recall"],
        intelligence_signal="antiCheat", model_category="classifier", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M137a", core_id="M137",
        model_name="Mid-Run Hotfix Triage + Quarantine Router",
        primary_function="Triage hotfix urgency vs. run-lock integrity; route critical fixes through quarantine without breaking active runs",
        what_it_adds=["Triage hotfix urgency vs. run-lock integrity constraints.",
                      "Route critical fixes through quarantine: never break active run determinism.",
                      "Generates hotfix impact assessment for engineering team."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["triage_urgency", "quarantine_route", "run_impact_assessment", "determinism_guard_passed"],
        eval_focus=["triage_accuracy", "quarantine_success_rate", "determinism_guard_pass_rate"],
        intelligence_signal="antiCheat", model_category="controller", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M138a", core_id="M138",
        model_name="Server Load Predictor + Graceful Degradation Planner",
        primary_function="Predict server load spikes before they impact runs; plan graceful feature degradation that preserves run integrity",
        what_it_adds=["Predict server load spikes before they impact active runs.",
                      "Plan graceful feature degradation: shed non-critical features, never run integrity.",
                      "Generates load shedding receipt for post-incident review."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["load_spike_prediction", "degradation_plan", "integrity_preservation_verified", "shedding_receipt"],
        eval_focus=["load_prediction_AUC", "degradation_plan_quality", "integrity_preservation_rate"],
        intelligence_signal="antiCheat", model_category="predictor", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M139a", core_id="M139",
        model_name="Offline Queue On-Device Verifier + Sync Priority Ranker",
        primary_function="Run lightweight on-device verification for offline queue runs; rank sync priority when connectivity restores",
        what_it_adds=["Run lightweight on-device verification for offline queue runs.",
                      "Rank sync priority when connectivity restores: integrity-critical runs sync first.",
                      "Generates offline run integrity certificates for server-side full verification."],
        tiers=["baseline", "sequence_dl"], placement=["client", "server"], budget="real_time",
        primary_outputs=["on_device_verification", "sync_priority_rank", "integrity_certificate", "full_verify_queued"],
        eval_focus=["on_device_accuracy", "sync_priority_calibration", "certificate_integrity_pass"],
        intelligence_signal="antiCheat", model_category="classifier", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M140a", core_id="M140",
        model_name="Player Evidence Export Redaction Assistant + Packet Summarizer",
        primary_function="Assist evidence packet redaction for privacy compliance; summarize export packet for player comprehension",
        what_it_adds=["Assist evidence packet redaction: remove PII without destroying evidentiary value.",
                      "Summarize export packet in plain language for player comprehension.",
                      "Generates redaction audit receipt for compliance."],
        tiers=["baseline", "sequence_dl"], placement=["server"], budget="batch",
        primary_outputs=["redacted_packet", "plain_language_summary", "redaction_audit_receipt", "evidentiary_value_score"],
        eval_focus=["redaction_privacy_compliance", "summary_clarity", "evidentiary_value_preservation"],
        intelligence_signal="antiCheat", model_category="generator", family="forensics",
        can_lock_off=True, priority=2, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M141a", core_id="M141",
        model_name="Async Table Proxy Vote Predictor + Fairness Guard",
        primary_function="Predict proxy vote outcomes for async table participants; guard against unfair proxy vote manipulation",
        what_it_adds=["Predict proxy vote outcomes for async participants who haven't cast yet.",
                      "Guard against unfair proxy manipulation: votes locked after timer regardless of outcome.",
                      "Generates async vote participation receipts."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["proxy_vote_prediction", "manipulation_flag", "participation_receipt", "fairness_score"],
        eval_focus=["proxy_prediction_calibration_ECE", "manipulation_AUC", "fairness_compliance_rate"],
        intelligence_signal="antiCheat", model_category="predictor", family="contract",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M142a", core_id="M142",
        model_name="House Rules Lobby Configuration Advisor + Safety Validator",
        primary_function="Advise lobby host on rule configuration that maximizes fun and fairness; validate against safety constraints before publishing",
        what_it_adds=["Advise lobby host on rule configurations that maximize fun and fairness.",
                      "Validate configurations against safety constraints before publishing.",
                      "Detects exploitative house rules disguised as 'custom lobbies'."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["configuration_advice", "safety_validation", "exploit_flag", "publication_approval"],
        eval_focus=["advice_acceptance_rate", "safety_validation_recall", "exploit_detection_AUC"],
        intelligence_signal="antiCheat", model_category="classifier", family="integrity",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M143a", core_id="M143",
        model_name="Table Penalties Brigading Detector + Toxicity Classifier",
        primary_function="Detect coordinated brigading patterns in penalty reports; classify toxicity from behavioral signals without ML override of rules",
        what_it_adds=["Detect coordinated brigading: groups filing false reports to punish legitimate play.",
                      "Classify toxicity from behavioral signals — rules decide, ML informs.",
                      "Generates brigading evidence chain for appeals."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["brigading_flag", "toxicity_classification", "evidence_chain", "rules_decision_input"],
        eval_focus=["brigading_AUC", "toxicity_classification_accuracy", "false_flag_rate"],
        intelligence_signal="antiCheat", model_category="anomaly_detector", family="integrity",
        can_lock_off=False, priority=1, training_phase=1,
    ),
    MLMechanicMeta(
        ml_id="M144a", core_id="M144",
        model_name="Spectator Theater Delay Optimizer + Prediction Bet Calibrator",
        primary_function="Optimize spectator delay to maximize drama without spoiling live outcome; calibrate prediction bet odds for fairness",
        what_it_adds=["Optimize spectator delay to maximize drama without spoiling live outcome.",
                      "Calibrate prediction bet odds in real time for fair expected value.",
                      "Anti-collusion: detects when spectators share live run state with active player."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["optimal_delay", "calibrated_bet_odds", "collusion_flag", "drama_score"],
        eval_focus=["delay_drama_lift", "bet_odds_calibration_ECE", "collusion_AUC"],
        intelligence_signal="rewardFit", model_category="controller", family="social",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M145a", core_id="M145",
        model_name="Tournament Bracket Seeding Fairness Model",
        primary_function="Generate tournament seeds that maximize competitive balance; verify bracket fairness against known skill distributions",
        what_it_adds=["Generate tournament seeds that maximize competitive balance across rounds.",
                      "Verify bracket fairness against known skill distributions.",
                      "Detects seed manipulation: players sandbagging to get favorable brackets."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="batch",
        primary_outputs=["seeding_assignment", "bracket_fairness_score", "sandbag_flag", "balance_verification"],
        eval_focus=["bracket_balance_index", "sandbag_detection_AUC", "fairness_rating"],
        intelligence_signal="antiCheat", model_category="predictor", family="balance",
        can_lock_off=True, priority=2, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M146a", core_id="M146",
        model_name="Audit Event Doc Burden Estimator + Auto-Fill Assistant",
        primary_function="Estimate documentation burden for audit events; auto-fill safe documentation templates to reduce friction",
        what_it_adds=["Estimate documentation burden for each audit event type.",
                      "Auto-fill safe documentation templates to reduce friction without sacrificing completeness.",
                      "Flags incomplete documentation before timer expires."],
        tiers=["baseline", "sequence_dl"], placement=["client", "server"], budget="real_time",
        primary_outputs=["burden_estimate", "auto_filled_template", "completeness_flag", "timer_warning"],
        eval_focus=["burden_estimate_accuracy", "auto_fill_acceptance_rate", "completeness_recall"],
        intelligence_signal="personalization", model_category="generator", family="forensics",
        can_lock_off=True, priority=3, training_phase=3,
    ),
    MLMechanicMeta(
        ml_id="M147a", core_id="M147",
        model_name="Litigation Risk Early Warning + Mitigation Planner",
        primary_function="Provide early warning of litigation risk triggers using causal run-state analysis; generate mitigation plans before trigger fires",
        what_it_adds=["Provide early warning of litigation risk triggers using causal run-state analysis.",
                      "Generate mitigation plans before the trigger fires — proactive, not reactive.",
                      "Generates litigation risk receipts for Case File."],
        tiers=["baseline", "sequence_dl", "causal"], placement=["client", "server"], budget="real_time",
        primary_outputs=["early_warning_signal", "mitigation_plan", "trigger_probability", "case_file_receipt"],
        eval_focus=["early_warning_lead_time", "mitigation_plan_quality", "trigger_prediction_AUC"],
        intelligence_signal="risk", model_category="predictor", family="contract",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M148a", core_id="M148",
        model_name="Counterparty Freeze Forecast + Premium Estimator",
        primary_function="Forecast counterparty freeze probability given current market state; estimate insurance premium for freeze protection",
        what_it_adds=["Forecast counterparty freeze probability given current market state.",
                      "Estimate fair insurance premium for freeze protection — never predatory.",
                      "Generates freeze risk receipts for contract negotiations."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["server"], budget="real_time",
        primary_outputs=["freeze_probability", "premium_estimate", "freeze_receipt", "market_state_signal"],
        eval_focus=["freeze_probability_calibration_ECE", "premium_fairness_rating", "freeze_prediction_AUC"],
        intelligence_signal="risk", model_category="predictor", family="contract",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M149a", core_id="M149",
        model_name="Regulatory Window Compliance Planner + Cost Minimizer",
        primary_function="Plan compliance actions for regulatory windows to minimize ongoing penalty cost; forecast non-compliance cascade",
        what_it_adds=["Plan compliance actions for regulatory windows to minimize ongoing penalty cost.",
                      "Forecast non-compliance cascade: what happens if the window is missed.",
                      "Generates compliance plan receipts for Case File."],
        tiers=["baseline", "sequence_dl", "policy_rl"], placement=["client", "server"], budget="real_time",
        primary_outputs=["compliance_plan", "penalty_cost_estimate", "non_compliance_cascade", "compliance_receipt"],
        eval_focus=["compliance_plan_quality", "penalty_estimate_accuracy", "cascade_prediction_AUC"],
        intelligence_signal="risk", model_category="predictor", family="contract",
        can_lock_off=True, priority=2, training_phase=2,
    ),
    MLMechanicMeta(
        ml_id="M150a", core_id="M150",
        model_name="Finality Ceremony Verifier Assistant + Final Card Composer",
        primary_function="Assist finality verification by pre-scoring run completeness; compose the final proof card with ceremony-grade presentation",
        what_it_adds=["Assist finality verification by pre-scoring run completeness before stamp issuance.",
                      "Compose the final proof card with ceremony-grade presentation: correct grade border, proof hash display, sovereignty title.",
                      "Generates finality ceremony receipts for league and social systems."],
        tiers=["baseline", "sequence_dl"], placement=["server"], budget="batch",
        primary_outputs=["completeness_score", "final_proof_card", "ceremony_receipt", "sovereignty_title"],
        eval_focus=["completeness_calibration_ECE", "proof_card_integrity_pass", "ceremony_presentation_rating"],
        intelligence_signal="rewardFit", model_category="generator", family="integrity",
        can_lock_off=True, priority=2, training_phase=3,
    ),
]

# ── Fast-access index ─────────────────────────────────────────────────────────
ML_INDEX: dict[str, MLMechanicMeta] = {m.ml_id.lower(): m for m in ML_TABLE}


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMA BRIDGE: MLMechanicMeta → MLMechanicRecord (mlLoader.ts compatible)
# ══════════════════════════════════════════════════════════════════════════════

_TIER_MODEL_OPTIONS: dict[str, dict[str, str]] = {
    # baseline → sequence_dl → policy_rl (Pattern A)
    "baseline_sequence_dl_policy_rl": {
        "baseline":  "GBM + calibrated logistic (fast, low-cost, production default)",
        "sequence":  "TCN / Transformer encoder over event streams",
        "policy":    "Constrained contextual bandit / offline PPO",
    },
    # baseline → sequence_dl → graph_dl → policy_rl (Pattern B)
    "baseline_sequence_dl_graph_dl_policy_rl": {
        "baseline":  "GBM + calibrated logistic (fast, low-cost, production default)",
        "sequence":  "TCN / Transformer encoder over event streams",
        "policy":    "GNN + constrained offline RL (relationship-aware)",
    },
    # baseline → sequence_dl → causal (M25a, M43a, M68a, M95a, M106a, M147a)
    "baseline_sequence_dl_causal": {
        "baseline":  "GBM + calibrated logistic (fast, low-cost, production default)",
        "sequence":  "TCN / Transformer encoder over event streams",
        "policy":    "DiD + causal forest (counterfactual explanation)",
    },
    # baseline → causal → retrieval (M132a only)
    "baseline_causal_retrieval": {
        "baseline":  "GBM + calibrated logistic (fast, low-cost, production default)",
        "sequence":  "Causal inference + DiD (root-cause ranking)",
        "policy":    "Dense retrieval over season case library",
    },
    # baseline → sequence_dl (M80a, M129a, M139a, M140a, M150a)
    "baseline_sequence_dl": {
        "baseline":  "GBM + calibrated logistic (fast, low-cost, production default)",
        "sequence":  "TCN / Transformer encoder over event streams",
        "policy":    "Rule-based fallback (ML tier not required)",
    },
    # baseline → policy_rl (M13a, M19a)
    "baseline_policy_rl": {
        "baseline":  "GBM + calibrated logistic (fast, low-cost, production default)",
        "sequence":  "GBM ensemble (extended feature window)",
        "policy":    "Offline PPO / constrained bandit",
    },
    # baseline → sequence_dl → graph_dl (M113a)
    "baseline_sequence_dl_graph_dl": {
        "baseline":  "GBM + calibrated logistic (fast, low-cost, production default)",
        "sequence":  "TCN / Transformer encoder over event streams",
        "policy":    "GNN (portfolio dependency graph, no RL tier)",
    },
    # baseline → sequence_dl → graph_dl → causal (M37a, M43a variant)
    "baseline_sequence_dl_graph_dl_causal": {
        "baseline":  "GBM + calibrated logistic (fast, low-cost, production default)",
        "sequence":  "TCN / Transformer encoder over event streams",
        "policy":    "GNN + causal forest (graph + counterfactual)",
    },
    # baseline → sequence_dl → causal (4 tiers with graph)
    "baseline_sequence_dl_graph_dl_causal_four": {
        "baseline":  "GBM + calibrated logistic (fast, low-cost, production default)",
        "sequence":  "TCN / Transformer encoder over event streams",
        "policy":    "GNN + causal forest (relationship-aware + counterfactual)",
    },
}


def _derive_model_options(meta: MLMechanicMeta) -> dict[str, str]:
    """Derive model_options dict compatible with mlLoader.ts MLMechanicRecord."""
    tiers_key = "_".join(meta.tiers)
    if tiers_key in _TIER_MODEL_OPTIONS:
        return _TIER_MODEL_OPTIONS[tiers_key]
    # Fallback: derive from tier list content
    has_graph   = "graph_dl" in meta.tiers
    has_causal  = "causal" in meta.tiers
    has_retr    = "retrieval" in meta.tiers
    has_policy  = "policy_rl" in meta.tiers
    has_seq     = "sequence_dl" in meta.tiers

    if has_retr:
        return _TIER_MODEL_OPTIONS["baseline_causal_retrieval"]
    if has_graph and has_causal:
        return _TIER_MODEL_OPTIONS["baseline_sequence_dl_graph_dl_causal"]
    if has_graph and has_policy:
        return _TIER_MODEL_OPTIONS["baseline_sequence_dl_graph_dl_policy_rl"]
    if has_graph:
        return _TIER_MODEL_OPTIONS["baseline_sequence_dl_graph_dl"]
    if has_causal:
        return _TIER_MODEL_OPTIONS["baseline_sequence_dl_causal"]
    if has_policy and has_seq:
        return _TIER_MODEL_OPTIONS["baseline_sequence_dl_policy_rl"]
    if has_policy:
        return _TIER_MODEL_OPTIONS["baseline_policy_rl"]
    if has_seq:
        return _TIER_MODEL_OPTIONS["baseline_sequence_dl"]
    return _TIER_MODEL_OPTIONS["baseline_policy_rl"]


def _infer_placement_union(placement: list[str]) -> str:
    if set(placement) == {"client", "server"} or set(placement) >= {"client", "server"}:
        return "both"
    if "client" in placement:
        return "client"
    return "server"


def _budget_to_batch(budget: str) -> int:
    return {"real_time": 1, "hybrid": 2, "batch": 3}.get(budget, 2)


def _derive_inputs(meta: MLMechanicMeta) -> list[str]:
    """Standard telemetry inputs, augmented per mechanic family."""
    base = ["runSeed", "tickIndex", "rulesetVersion", "portfolioSnapshot", "actionTimeline"]
    if meta.family in ("integrity", "forensics"):
        base += ["ledgerEvents", "signedReceipts"]
    if meta.family in ("contract", "co_op"):
        base += ["contractGraph", "partnerHistory"]
    if meta.family == "social":
        base += ["socialEvents", "consentProfile"]
    if meta.model_category == "anomaly_detector":
        base += ["deviceFingerprint", "networkFingerprint"]
    if "causal" in meta.tiers:
        base += ["naturalExperimentSlice", "diffInDiffWindow"]
    return list(dict.fromkeys(base))  # dedupe preserving order


def _derive_telemetry_events(meta: MLMechanicMeta) -> list[str]:
    """Derive the telemetry events this mechanic subscribes to."""
    events = [f"{meta.core_id}_resolve", f"{meta.core_id}_exec_start"]
    if meta.budget == "batch":
        events.append("run_end")
    if meta.family == "integrity":
        events += ["ledger_commit", "replay_checkpoint"]
    if meta.family == "social":
        events += ["social_token_play", "table_vote_cast"]
    if meta.intelligence_signal == "antiCheat":
        events += ["anomaly_flag_raised", "exploit_taxonomy_update"]
    return events


_STANDARD_GUARDRAILS = [
    "ML can suggest; rules decide — NEVER rewrite resolved ledger history",
    "All outputs have explicit caps (score ≤ 1.0) + monotonic constraints",
    "Every inference writes signed audit receipt (ruleset_version, seed, tick, cap, output)",
    "No contact-graph mining; in-session signals only for social reasoning",
]


def _derive_heuristic_substitute(meta: MLMechanicMeta) -> str:
    """Generate the App.tsx IntelligenceState substitute expression."""
    signal = meta.intelligence_signal
    mapping = {
        "alpha":               "portfolioValue * cashflowRate",
        "risk":                "debtServiceRatio * cascadeExposure",
        "volatility":          "macroRegimeConfidence * shockProbability",
        "antiCheat":           "replayConsistencyScore * signatureValidity",
        "personalization":     "skillBandIndex * sessionProgressionRate",
        "rewardFit":           "momentYieldPerRun * shareEventDensity",
        "recommendationPower": "archetypeMatchScore * noveltyEntropy",
        "churnRisk":           "(1 - retentionRate) * ragequitCorrelation",
        "momentum":            "recentDecisionSpeed * clutchWindowCapture",
    }
    return mapping.get(signal, f"intelligence.{signal}")


# ══════════════════════════════════════════════════════════════════════════════
# REGISTRY BUILDERS
# ══════════════════════════════════════════════════════════════════════════════

def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", s.lower())[:55].strip("_")


def _camel(s: str) -> str:
    parts = re.sub(r"[^a-z0-9]+", "_", s.lower()).split("_")
    return parts[0] + "".join(w.capitalize() for w in parts[1:])


def _pascal(s: str) -> str:
    return "".join(w.capitalize() for w in s.split("_"))


def build_extended_registry(only: list[str] | None = None) -> list[dict]:
    """Extended registry — ml_mechanics_core.json schema."""
    records = []
    for meta in ML_TABLE:
        mid = meta.ml_id.lower()
        if only and mid not in [x.lower() for x in only]:
            continue
        stem = f"{mid}_{_slug(meta.model_name)}"
        records.append({
            "task_id":          f"PZO-{meta.ml_id.upper()}",
            "ml_id":            meta.ml_id.upper(),
            "core_id":          meta.core_id,
            "model_name":       meta.model_name,
            "primary_function": meta.primary_function,
            "what_it_adds":     meta.what_it_adds,
            "tiers":            meta.tiers,
            "placement":        meta.placement,
            "budget":           meta.budget,
            "primary_outputs":  meta.primary_outputs,
            "eval_focus":       meta.eval_focus,
            "can_lock_off":     meta.can_lock_off,
            "status":           meta.status,
            "module_path":      f"src/ml/{stem}.ts",
            "intelligence_signal": meta.intelligence_signal,
            "model_category":   meta.model_category,
            "family":           meta.family,
            "priority":         meta.priority,
            "training_phase":   meta.training_phase,
        })
    return records


def build_loader_registry(only: list[str] | None = None) -> list[dict]:
    """
    mlLoader-compatible registry — ml_core.json schema.
    Shape matches MLMechanicRecord in mlLoader.ts exactly.
    """
    records = []
    for meta in ML_TABLE:
        mid = meta.ml_id.lower()
        if only and mid not in [x.lower() for x in only]:
            continue
        stem = f"{mid}_{_slug(meta.model_name)}"
        fn_name = _camel(f"run_{mid}_ml")
        records.append({
            "task_id":             f"PZO-{meta.ml_id.upper()}",
            "mechanic_id":         meta.ml_id.lower(),      # M01a (lowercase)
            "core_pair":           meta.core_id,            # M01
            "title":               meta.model_name,
            "what_it_adds":        " ".join(meta.what_it_adds),
            "family":              meta.family,
            "kind":                "ml",
            "model_category":      meta.model_category,
            "inference_placement": _infer_placement_union(meta.placement),
            "intelligence_signal": meta.intelligence_signal,
            "heuristic_substitute": _derive_heuristic_substitute(meta),
            "training_phase":      meta.training_phase,
            "status":              meta.status,
            "priority":            meta.priority,
            "inputs":              _derive_inputs(meta),
            "outputs":             meta.primary_outputs,
            "telemetry_events":    _derive_telemetry_events(meta),
            "guardrails":          (
                _STANDARD_GUARDRAILS + [
                    f"Competitive lock-off: {'ML balance nudges disabled, integrity always on' if meta.can_lock_off else 'NEVER disabled — always-on integrity'}"
                ]
            ),
            "model_options":       _derive_model_options(meta),
            "module_path":         f"src/ml/{stem}.ts",
            "exec_hook":           f"after_{meta.core_id.lower()}_resolve",
            "runtime_call":        f"{fn_name}(telemetry, tier, modelCard)",
            "batch":               _budget_to_batch(meta.budget),
        })
    return records


# ══════════════════════════════════════════════════════════════════════════════
# TYPESCRIPT STUB GENERATOR
# ══════════════════════════════════════════════════════════════════════════════

TIER_DESCRIPTIONS = {
    "baseline":    "GBM + calibrated logistic (fast, low-cost, production default)",
    "sequence_dl": "TCN / Transformer encoder over event streams (sequential patterns)",
    "graph_dl":    "GNN over contract / market / ledger graphs (relationship-aware)",
    "policy_rl":   "Constrained contextual bandit / offline PPO (bounded nudges)",
    "causal":      "Causal inference + DiD (counterfactual explanations)",
    "retrieval":   "Dense retrieval over season case library (similarity search)",
}

PLACEMENT_DESCRIPTIONS = {
    "client":   "On-device — privacy-safe, low-latency UX signals",
    "server":   "Server-side — integrity, balancing, anti-abuse, economy",
    "post_run": "Post-run batch — forensics, case files, season analytics",
}


def _tier_interface(tier: str, mid: str) -> str:
    desc = TIER_DESCRIPTIONS.get(tier, tier)
    return (
        f"/** {mid} — Tier: {tier.upper()}\n"
        f" *  {desc}\n"
        f" */\n"
        f"export interface {mid}{_pascal(tier)}Config {{\n"
        f"  enabled:          boolean;\n"
        f"  modelVersion:     string;\n"
        f"  featureSchemaHash: string;\n"
        f"  latencySLOMs:     number;   // 0 = batch/async\n"
        f"}}"
    )


def generate_ml_ts_stub(record: dict) -> str:
    mid          = record["ml_id"]
    core_id      = record["core_id"]
    model_name   = record["model_name"]
    prim_fn      = record["primary_function"]
    what_adds    = record["what_it_adds"]
    tiers        = record["tiers"]
    placement    = record["placement"]
    budget       = record["budget"]
    outputs      = record["primary_outputs"]
    eval_focus   = record["eval_focus"]
    can_lock     = record["can_lock_off"]
    module_path  = record["module_path"]
    intel_signal = record.get("intelligence_signal", "risk")
    model_cat    = record.get("model_category", "predictor")
    family       = record.get("family", "market")

    adds_block   = "\n".join(f" * {i+1}. {w}" for i, w in enumerate(what_adds))
    tier_ifaces  = "\n\n".join(_tier_interface(t, mid) for t in tiers)
    out_fields   = "\n".join(f"  {_camel(o)}: unknown;  // {o}" for o in outputs)
    eval_entries = "\n".join(f"  /** {e} */" for e in eval_focus)
    tier_union   = " | ".join(f"'{t}'" for t in tiers)
    place_union  = " | ".join(f"'{p}'" for p in placement)
    place_lines  = "\n".join(
        f"  /** {PLACEMENT_DESCRIPTIONS.get(p, p)} */\n  {p}: boolean;"
        for p in placement
    )
    fn_name      = _camel(f"run_{mid.lower()}_ml")
    tier_routes  = "".join(
        f"  // □ tier === '{t}' → {TIER_DESCRIPTIONS.get(t, t)}\n"
        for t in tiers
    )
    inputs_list  = record.get("inputs", [])
    tel_events   = record.get("telemetry_events", [])

    return f"""\
// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — {module_path}
// AUTO-GENERATED by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : {mid} — {model_name}
// Core Pair    : {core_id}
// Family       : {family}
// Category     : {model_cat}
// IntelSignal  : {intel_signal}
// Tiers        : {', '.join(t.upper() for t in tiers)}
// Placement    : {', '.join(placement)}
// Budget       : {budget}
// Lock-Off     : {'NO — always active (integrity / anti-cheat)' if not can_lock else 'YES — competitive mode can disable balance nudges'}
//
// ML Design Laws (non-negotiable):
//   ✦ ML can suggest; rules decide — NEVER rewrite resolved ledger history
//   ✦ Bounded nudges — all outputs have explicit caps + monotonic constraints
//   ✦ Auditability — every inference writes (ruleset_version, seed, tick, cap, output)
//   ✦ Privacy — no contact-graph mining; in-session signals only
//
// Density6 LLC · Point Zero One · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════════

// ── What this adds ────────────────────────────────────────────────────────────
/**
 * {mid} — {model_name}
 *
 * Primary function:
 *   {prim_fn}
 *
 * What this adds to {core_id}:
{adds_block}
 *
 * Intelligence signal → IntelligenceState.{intel_signal}
 * Core mechanic pair  → {core_id}
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface {mid}TelemetryInput {{
  runSeed:           string;
  tickIndex:         number;
  rulesetVersion:    string;
  macroRegime:       string;
  portfolioSnapshot: Record<string, unknown>;
  actionTimeline:    Record<string, unknown>[];
  uiInteraction:     Record<string, unknown>;
  socialEvents:      Record<string, unknown>[];
  outcomeEvents:     Record<string, unknown>[];
  ledgerEvents?:     Record<string, unknown>[];
  contractGraph?:    Record<string, unknown>;
  userOptIn:         Record<string, boolean>;
  // Extended inputs for {mid} ({family} family)
{chr(10).join(f"  {_camel(i)}?: unknown;" for i in inputs_list if i not in ["runSeed","tickIndex","rulesetVersion","portfolioSnapshot","actionTimeline","socialEvents","ledgerEvents","contractGraph"])}
}}

// Telemetry events subscribed by {mid}
// {', '.join(tel_events)}

// ── Primary output contract ───────────────────────────────────────────────────
export interface {mid}BaseOutput {{
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}}

export interface {mid}Output extends {mid}BaseOutput {{
{out_fields}
}}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type {mid}Tier = {tier_union};

{tier_ifaces}

// ── Inference placement ───────────────────────────────────────────────────────
export type {mid}Placement = {place_union};

export interface {mid}InferencePlacement {{
{place_lines}
  budget: '{budget}';
}}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface {mid}Guardrails {{
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   {str(can_lock).lower()};
  scoreCap:                    1.0;
  abstainThreshold:            number;
}}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface {mid}EvalContract {{
{eval_entries}
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}}

// ── Model card ────────────────────────────────────────────────────────────────
export interface {mid}ModelCard {{
  modelId:            '{mid}';
  coreMechanicPair:   '{core_id}';
  intelligenceSignal: '{intel_signal}';
  modelCategory:      '{model_cat}';
  family:             '{family}';
  tier:               {mid}Tier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}}

// ── Constants ─────────────────────────────────────────────────────────────────
export const {mid}_ML_CONSTANTS = {{
  ML_ID:              '{mid}',
  CORE_PAIR:          '{core_id}',
  MODEL_NAME:         '{model_name}',
  INTEL_SIGNAL:       '{intel_signal}' as const,
  MODEL_CATEGORY:     '{model_cat}' as const,
  FAMILY:             '{family}' as const,
  TIERS:              [{', '.join(f"'{t}'" for t in tiers)}] as const,
  PLACEMENT:          [{', '.join(f"'{p}'" for p in placement)}] as const,
  BUDGET:             '{budget}' as const,
  CAN_LOCK_OFF:        {str(can_lock).lower()},
  GUARDRAILS: {{
    determinismPreserved:      true,
    boundedNudges:             true,
    auditabilityRequired:      true,
    privacyEnforced:           true,
    competitiveLockOffAllowed: {str(can_lock).lower()},
    scoreCap:                  1.0,
    abstainThreshold:          0.35,
  }},
  EVAL_FOCUS:         {json.dumps(eval_focus)},
  PRIMARY_OUTPUTS:    {json.dumps(outputs)},
  TELEMETRY_EVENTS:   {json.dumps(tel_events)},
}} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * {fn_name}
 *
 * Fires after {core_id} exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off={str(can_lock).lower()}).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         {mid}Output with signed auditHash
 */
export async function {fn_name}(
  input:     {mid}TelemetryInput,
  tier:      {mid}Tier = 'baseline',
  modelCard: Omit<{mid}ModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<{mid}Output> {{
  // ── TODO: implement {mid} — {model_name} ─────────────────────────────────
  //
  // Implementation checklist:
  // □ Validate input schema against featureSchemaHash
  // □ Select inference backend based on `tier` parameter
{tier_routes}  // □ Apply input privacy filters (no PII, no cross-player contact graph)
  // □ Run inference → raw score + top_factors
  // □ Apply output caps: score = Math.min(score, {mid}_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < {mid}_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return {mid}Output — NEVER mutate run state directly
  //
  // Placement: {', '.join(placement)} | Budget: {budget}
  // ExecHook:  after_{core_id.lower()}_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('{mid} ({model_name}) ML inference not yet implemented.');
}}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * {fn_name}Fallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) {mid}Output.
 * Competitive modes use this when ML nudges are locked off.
 */
export function {fn_name}Fallback(
  _input: {mid}TelemetryInput,
): {mid}Output {{
  // TODO: implement rule-based fallback for {mid}
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all {mid}-specific extended outputs
  throw new Error('{mid} fallback not yet implemented.');
}}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.{intel_signal}
// Heuristic substitute (until ML is live):
//   intelligence.{intel_signal} = {_derive_heuristic_substitute(ML_INDEX.get(mid.lower()) or ML_INDEX.get(mid))}
// Replace with: {fn_name}(telemetry, tier, modelCard).then(out => intelligence.{intel_signal} = out.score)
"""


# ══════════════════════════════════════════════════════════════════════════════
# BARREL + ROUTER
# ══════════════════════════════════════════════════════════════════════════════

def generate_ml_barrel(records: list[dict]) -> str:
    lines = [
        "// AUTO-GENERATED by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY",
        "// Density6 LLC · Point Zero One · Confidential",
        "// Re-generate: python3 scripts/build_ml_mechanics.py --force",
        "",
    ]
    for r in records:
        stem = Path(r["module_path"]).stem
        lines.append(f"export * from './{stem}';")
    return "\n".join(lines) + "\n"


def generate_ml_router(records: list[dict]) -> str:
    lines = [
        "// AUTO-GENERATED by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY",
        "// Density6 LLC · Point Zero One · Confidential",
        "// MLMechanicsRouter — dispatch table for all 150 ML companion mechanics",
        "",
        "export type MLBudget   = 'real_time' | 'batch' | 'hybrid';",
        "export type MLFamily   = 'integrity' | 'market' | 'social' | 'contract' | 'economy' | 'progression' | 'balance' | 'forensics' | 'co_op';",
        "export type MLCategory = 'classifier' | 'predictor' | 'recommender' | 'rl_policy' | 'anomaly_detector' | 'generator' | 'controller' | 'embedding_model';",
        "export type MLIntelSignal = 'alpha' | 'risk' | 'volatility' | 'antiCheat' | 'personalization' | 'rewardFit' | 'recommendationPower' | 'churnRisk' | 'momentum';",
        "",
        "export interface MLDispatch {",
        "  ml_id:             string;    // 'M01A'",
        "  core_id:           string;    // 'M01'",
        "  mechanic_id:       string;    // 'M01a' (lowercase, mlLoader key)",
        "  model_name:        string;",
        "  intelligence_signal: MLIntelSignal;",
        "  model_category:    MLCategory;",
        "  family:            MLFamily;",
        "  tiers:             readonly string[];",
        "  placement:         readonly string[];",
        "  budget:            MLBudget;",
        "  can_lock_off:      boolean;",
        "  priority:          1 | 2 | 3;",
        "  training_phase:    1 | 2 | 3;",
        "  exec_hook:         string;",
        "}",
        "",
        "/** Full dispatch table — one entry per ML mechanic. */",
        "export const ML_DISPATCH_TABLE: readonly MLDispatch[] = [",
    ]
    for r in records:
        tiers_s = ", ".join(f"'{t}'" for t in r["tiers"])
        place_s = ", ".join(f"'{p}'" for p in r["placement"])
        exec_hook = f"after_{r['core_id'].lower()}_resolve"
        lines.append(
            f"  {{"
            f" ml_id: '{r['ml_id']}', core_id: '{r['core_id']}', mechanic_id: '{r['ml_id'].lower()}a' if not r['ml_id'].lower().endswith('a') else '{r['ml_id'].lower()}',"
            f" model_name: {json.dumps(r['model_name'][:60])},"
            f" intelligence_signal: '{r.get('intelligence_signal','risk')}',"
            f" model_category: '{r.get('model_category','predictor')}',"
            f" family: '{r.get('family','market')}',"
            f" tiers: [{tiers_s}], placement: [{place_s}],"
            f" budget: '{r['budget']}', can_lock_off: {str(r['can_lock_off']).lower()},"
            f" priority: {r.get('priority',2)}, training_phase: {r.get('training_phase',2)},"
            f" exec_hook: '{exec_hook}' }},"
        )
    lines += [
        "] as const;",
        "",
        "// ── Query helpers ────────────────────────────────────────────────────────────",
        "export function getMLDispatch(ml_id: string): MLDispatch | undefined {",
        "  return ML_DISPATCH_TABLE.find(d => d.ml_id === ml_id.toUpperCase() || d.mechanic_id === ml_id.toLowerCase());",
        "}",
        "export function getMLForCore(core_id: string): readonly MLDispatch[] {",
        "  return ML_DISPATCH_TABLE.filter(d => d.core_id === core_id);",
        "}",
        "export function getMLBySignal(signal: MLIntelSignal): readonly MLDispatch[] {",
        "  return ML_DISPATCH_TABLE.filter(d => d.intelligence_signal === signal);",
        "}",
        "export function getMLByFamily(family: MLFamily): readonly MLDispatch[] {",
        "  return ML_DISPATCH_TABLE.filter(d => d.family === family);",
        "}",
        "export function getMLByCategory(cat: MLCategory): readonly MLDispatch[] {",
        "  return ML_DISPATCH_TABLE.filter(d => d.model_category === cat);",
        "}",
        "export function getRealTimeMLMechanics(): readonly MLDispatch[] {",
        "  return ML_DISPATCH_TABLE.filter(d => d.budget === 'real_time');",
        "}",
        "export function getBatchMLMechanics(): readonly MLDispatch[] {",
        "  return ML_DISPATCH_TABLE.filter(d => d.budget === 'batch');",
        "}",
        "export function getAlwaysOnMLMechanics(): readonly MLDispatch[] {",
        "  return ML_DISPATCH_TABLE.filter(d => !d.can_lock_off);",
        "}",
        "export function getPhase1MLMechanics(): readonly MLDispatch[] {",
        "  return ML_DISPATCH_TABLE.filter(d => d.training_phase === 1);",
        "}",
        "export function getMLByPriority(p: 1|2|3): readonly MLDispatch[] {",
        "  return ML_DISPATCH_TABLE.filter(d => d.priority === p);",
        "}",
        "",
    ]
    return "\n".join(lines)


# ── Patched mlLoader.ts ───────────────────────────────────────────────────────

ML_LOADER_TS = '''\
// pzo-web/src/data/mlLoader.ts
// Auto-generated from ml_core.json — DO NOT EDIT MANUALLY
// Re-generate: python3 scripts/build_ml_mechanics.py --force

export type MLModelCategory =
  | 'classifier'
  | 'predictor'
  | 'recommender'
  | 'rl_policy'
  | 'anomaly_detector'
  | 'generator'
  | 'controller'
  | 'embedding_model';

export type MLInferencePlacement = 'client' | 'server' | 'both';

export type MLStatus =
  | 'simulated'    // Running as IntelligenceState heuristic
  | 'wiring'       // Being connected to game state
  | 'training'     // Collecting run data
  | 'deployed';    // Live model serving

export type MLFamily =
  | 'integrity' | 'market' | 'social' | 'contract'
  | 'economy' | 'progression' | 'balance' | 'forensics' | 'co_op';

export type MLIntelSignal =
  | 'alpha' | 'risk' | 'volatility' | 'antiCheat'
  | 'personalization' | 'rewardFit' | 'recommendationPower'
  | 'churnRisk' | 'momentum';

export interface MLMechanicRecord {
  task_id:              string;       // PZO-M01A
  mechanic_id:          string;       // M01a (lowercase)
  core_pair:            string;       // M01
  title:                string;
  what_it_adds:         string;       // joined bullet string
  family:               MLFamily;
  kind:                 'ml';
  model_category:       MLModelCategory;
  inference_placement:  MLInferencePlacement;
  intelligence_signal:  MLIntelSignal;
  heuristic_substitute: string;
  training_phase:       1 | 2 | 3;
  status:               MLStatus;
  priority:             1 | 2 | 3;
  inputs:               string[];
  outputs:              string[];
  telemetry_events:     string[];
  guardrails:           string[];
  model_options:        { baseline: string; sequence: string; policy: string };
  module_path:          string;
  exec_hook:            string;
  runtime_call:         string;
  batch:                1 | 2 | 3;
}

import rawML from \'./ml_core.json\';

// ── IntelligenceState ─────────────────────────────────────────────────────────
export type IntelligenceState = {
  alpha:               number;
  risk:                number;
  volatility:          number;
  antiCheat:           number;
  personalization:     number;
  rewardFit:           number;
  recommendationPower: number;
  churnRisk:           number;
  momentum:            number;
};

export const ML_REGISTRY: MLMechanicRecord[] = rawML as MLMechanicRecord[];

// ── Lookup helpers ────────────────────────────────────────────────────────────
export function getMLMechanic(id: string): MLMechanicRecord | undefined {
  return ML_REGISTRY.find(m => m.mechanic_id === id.toLowerCase() || m.task_id === id.toUpperCase());
}
export function getMLForCore(coreId: string): MLMechanicRecord | undefined {
  return ML_REGISTRY.find(m => m.core_pair === coreId);
}
export function getAllMLForCore(coreId: string): MLMechanicRecord[] {
  return ML_REGISTRY.filter(m => m.core_pair === coreId);
}
export function getMLByCategory(cat: MLModelCategory): MLMechanicRecord[] {
  return ML_REGISTRY.filter(m => m.model_category === cat);
}
export function getMLByStatus(status: MLStatus): MLMechanicRecord[] {
  return ML_REGISTRY.filter(m => m.status === status);
}
export function getMLByIntelSignal(signal: MLIntelSignal): MLMechanicRecord[] {
  return ML_REGISTRY.filter(m => m.intelligence_signal === signal);
}
export function getMLByFamily(family: MLFamily): MLMechanicRecord[] {
  return ML_REGISTRY.filter(m => m.family === family);
}
export function getIntelligenceFeed(field: keyof IntelligenceState): MLMechanicRecord[] {
  return ML_REGISTRY.filter(m => m.intelligence_signal === field);
}

// ── Phase buckets ─────────────────────────────────────────────────────────────
export const ML_PHASE_1 = ML_REGISTRY.filter(m => m.training_phase === 1);  // Build now
export const ML_PHASE_2 = ML_REGISTRY.filter(m => m.training_phase === 2);  // After 100 runs
export const ML_PHASE_3 = ML_REGISTRY.filter(m => m.training_phase === 3);  // After 500 runs

// ── Status buckets ────────────────────────────────────────────────────────────
export const ML_SIMULATED = ML_REGISTRY.filter(m => m.status === \'simulated\');
export const ML_WIRING    = ML_REGISTRY.filter(m => m.status === \'wiring\');
export const ML_TRAINING  = ML_REGISTRY.filter(m => m.status === \'training\');
export const ML_DEPLOYED  = ML_REGISTRY.filter(m => m.status === \'deployed\');

// ── Priority buckets ──────────────────────────────────────────────────────────
export const ML_P1 = ML_REGISTRY.filter(m => m.priority === 1);  // Critical path
export const ML_P2 = ML_REGISTRY.filter(m => m.priority === 2);  // Standard
export const ML_P3 = ML_REGISTRY.filter(m => m.priority === 3);  // Nice-to-have

// ── Batch / placement helpers ─────────────────────────────────────────────────
export const ML_REAL_TIME = ML_REGISTRY.filter(m => m.batch === 1);
export const ML_HYBRID    = ML_REGISTRY.filter(m => m.batch === 2);
export const ML_BATCH     = ML_REGISTRY.filter(m => m.batch === 3);
export const ML_ALWAYS_ON = ML_REGISTRY.filter(m =>
  m.guardrails.some(g => g.includes('NEVER disabled'))
);
'''


# ══════════════════════════════════════════════════════════════════════════════
# MD FILE PARSER (optional — reads existing .md specs if present)
# ══════════════════════════════════════════════════════════════════════════════

def parse_ml_md(path: Path) -> dict:
    text = path.read_text(encoding="utf-8", errors="replace")
    sections: dict[str, str] = {}
    current, buf = None, []
    for line in text.split("\n"):
        h = re.match(r"^##\s+(.+)$", line)
        if h:
            if current:
                sections[current] = "\n".join(buf).strip()
            current, buf = h.group(1).strip(), []
        elif current:
            buf.append(line)
    if current:
        sections[current] = "\n".join(buf).strip()
    h1 = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
    return {
        "title_raw": h1.group(1).strip() if h1 else "",
        "sections":  sections,
    }


# ══════════════════════════════════════════════════════════════════════════════
# VALIDATION
# ══════════════════════════════════════════════════════════════════════════════

def validate_registry(records: list[dict]) -> list[str]:
    errors = []
    seen_ids = set()
    valid_signals = {"alpha","risk","volatility","antiCheat","personalization","rewardFit","recommendationPower","churnRisk","momentum"}
    valid_cats    = {"classifier","predictor","recommender","rl_policy","anomaly_detector","generator","controller","embedding_model"}
    valid_fams    = {"integrity","market","social","contract","economy","progression","balance","forensics","co_op"}

    for r in records:
        mid = r["ml_id"]
        if mid in seen_ids:
            errors.append(f"{mid}: duplicate ml_id")
        seen_ids.add(mid)
        if not r.get("tiers"):
            errors.append(f"{mid}: no model tiers defined")
        if not r.get("placement"):
            errors.append(f"{mid}: no inference placement defined")
        if not r.get("primary_outputs"):
            errors.append(f"{mid}: no primary outputs defined")
        if not r.get("what_it_adds"):
            errors.append(f"{mid}: what_it_adds is empty")
        if r.get("intelligence_signal") not in valid_signals:
            errors.append(f"{mid}: invalid intelligence_signal '{r.get('intelligence_signal')}'")
        if r.get("model_category") not in valid_cats:
            errors.append(f"{mid}: invalid model_category '{r.get('model_category')}'")
        if r.get("family") not in valid_fams:
            errors.append(f"{mid}: invalid family '{r.get('family')}'")
    return errors


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Point Zero One — ML Mechanics Build System (Density6 LLC)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--dry-run",    action="store_true", help="Print what would be written, don't write")
    parser.add_argument("--only",       default="",          help="Comma-separated ML IDs to process (e.g. M01a,M06a)")
    parser.add_argument("--force",      action="store_true", help="Overwrite existing TS stubs")
    parser.add_argument("--validate",   action="store_true", help="Validate only, then exit")
    parser.add_argument("--stats",      action="store_true", help="Print distribution stats, then exit")
    parser.add_argument("--no-ts",      action="store_true", help="Skip TS stub generation")
    parser.add_argument("--no-loader",  action="store_true", help="Skip mlLoader.ts patch")
    # Path overrides
    parser.add_argument("--workspace",  default=str(WORKSPACE_ROOT), help="Workspace root path")
    parser.add_argument("--json-out",   default="",   help="Override ml_mechanics_core.json path")
    parser.add_argument("--core-out",   default="",   help="Override ml_core.json path")
    parser.add_argument("--ts-out-dir", default="",   help="Override TS output dir")
    parser.add_argument("--loader-out", default="",   help="Override mlLoader.ts path")
    args = parser.parse_args()

    ws          = Path(args.workspace)
    json_out    = Path(args.json_out)  if args.json_out  else ws / "pzo-web/src/data/ml_mechanics_core.json"
    core_out    = Path(args.core_out)  if args.core_out  else ws / "pzo-web/src/data/ml_core.json"
    ts_out_dir  = Path(args.ts_out_dir) if args.ts_out_dir else ws / "pzo_engine/src/ml"
    loader_out  = Path(args.loader_out) if args.loader_out else ws / "pzo-web/src/data/mlLoader.ts"

    only = [x.strip() for x in args.only.split(",") if x.strip()] if args.only else None

    print(f"\n{'='*72}")
    print(f"  PZO ML Mechanics Build System — Density6 LLC")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*72}")
    print(f"  Workspace    : {ws}")
    print(f"  JSON (ext)   : {json_out}")
    print(f"  JSON (loader): {core_out}")
    print(f"  TS stubs     : {ts_out_dir}")
    print(f"  mlLoader.ts  : {loader_out}")
    print(f"  Dry-run      : {args.dry_run}")
    if only:
        print(f"  Filter       : {', '.join(only)}")
    print()

    # ── Build registries ──────────────────────────────────────────────────────
    ext_records    = build_extended_registry(only=only)
    loader_records = build_loader_registry(only=only)
    print(f"  Registry built: {len(ext_records)} ML mechanics")

    # ── Stats mode ────────────────────────────────────────────────────────────
    if args.stats:
        from collections import Counter
        tier_c  = Counter(t for r in ext_records for t in r["tiers"])
        budget_c= Counter(r["budget"]             for r in ext_records)
        place_c = Counter(p for r in ext_records for p in r["placement"])
        sig_c   = Counter(r.get("intelligence_signal","?") for r in ext_records)
        cat_c   = Counter(r.get("model_category","?")      for r in ext_records)
        fam_c   = Counter(r.get("family","?")               for r in ext_records)
        lock_off= sum(1 for r in ext_records if not r["can_lock_off"])
        ph1     = sum(1 for r in ext_records if r.get("training_phase")==1)

        def _print_dist(label, ctr):
            print(f"\n  ── {label} {'─'*(52-len(label))}")
            for k, v in sorted(ctr.items(), key=lambda x: -x[1]):
                print(f"    {k:<28} {v:>3}")

        _print_dist("Tier distribution",              tier_c)
        _print_dist("Budget distribution",            budget_c)
        _print_dist("Placement distribution",         place_c)
        _print_dist("Intelligence signal distribution", sig_c)
        _print_dist("Model category distribution",    cat_c)
        _print_dist("Family distribution",            fam_c)
        print(f"\n  Always-on (can_lock_off=False): {lock_off}")
        print(f"  Phase 1 (build now):            {ph1}")
        sys.exit(0)

    # ── Validate ──────────────────────────────────────────────────────────────
    errors = validate_registry(ext_records)
    if errors:
        print(f"\n  ✗ Validation errors ({len(errors)}):")
        for e in errors:
            print(f"    · {e}")
        if args.validate:
            sys.exit(1)
        print("  ⚠  Continuing despite validation errors (use --validate to halt)")
    else:
        print(f"  ✓ Validation passed ({len(ext_records)} records clean)")

    if args.validate:
        sys.exit(0)

    # ── Write ml_mechanics_core.json (extended) ───────────────────────────────
    ext_payload = json.dumps(ext_records, indent=2, ensure_ascii=False) + "\n"
    if args.dry_run:
        print(f"\n  [dry-run] Would write {len(ext_payload):,} bytes → {json_out}")
    else:
        json_out.parent.mkdir(parents=True, exist_ok=True)
        json_out.write_text(ext_payload, encoding="utf-8")
        print(f"  ✓ {json_out.name}  ({len(ext_payload):,} bytes, {len(ext_records)} records)")

    # ── Write ml_core.json (mlLoader-compatible) ──────────────────────────────
    core_payload = json.dumps(loader_records, indent=2, ensure_ascii=False) + "\n"
    if args.dry_run:
        print(f"  [dry-run] Would write {len(core_payload):,} bytes → {core_out}")
    else:
        core_out.parent.mkdir(parents=True, exist_ok=True)
        core_out.write_text(core_payload, encoding="utf-8")
        print(f"  ✓ {core_out.name}  ({len(core_payload):,} bytes, {len(loader_records)} records)")

    # ── Patch mlLoader.ts ─────────────────────────────────────────────────────
    if not args.no_loader:
        if args.dry_run:
            print(f"  [dry-run] Would write → {loader_out}")
        else:
            loader_out.parent.mkdir(parents=True, exist_ok=True)
            loader_out.write_text(ML_LOADER_TS, encoding="utf-8")
            print(f"  ✓ {loader_out.name}  (patched — imports ml_core.json)")

    # ── Generate TS stubs ─────────────────────────────────────────────────────
    if not args.no_ts:
        ts_out_dir.mkdir(parents=True, exist_ok=True)
        written = skipped = 0
        for record in ext_records:
            stem    = Path(record["module_path"]).stem
            ts_path = ts_out_dir / f"{stem}.ts"
            if ts_path.exists() and not args.force:
                skipped += 1
                continue
            stub = generate_ml_ts_stub(record)
            if args.dry_run:
                print(f"  [dry-run] Would write → {ts_path.name}")
            else:
                ts_path.write_text(stub, encoding="utf-8")
                written += 1
        if not args.dry_run:
            print(f"  ✓ TS stubs: {written} written, {skipped} skipped (use --force to overwrite)")

        # Barrel + Router
        for fname, content_fn in [
            ("index.ts",           generate_ml_barrel),
            ("MLMechanicsRouter.ts", generate_ml_router),
        ]:
            fpath   = ts_out_dir / fname
            content = content_fn(ext_records)
            if args.dry_run:
                print(f"  [dry-run] Would write → {fpath.name}")
            else:
                fpath.write_text(content, encoding="utf-8")
                print(f"  ✓ {fpath.name}")

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n  {'='*68}")
    print(f"  Build complete — {len(ext_records)} ML mechanics")
    print(f"  {'='*68}")
    print(f"  JSON (extended):  {json_out}")
    print(f"  JSON (mlLoader):  {core_out}")
    print(f"  TS stubs:         {ts_out_dir}/  ({len(ext_records)} files)")
    print(f"  mlLoader.ts:      {loader_out}")
    print()
    print("  Implementation sequence:")
    print("    1. python3 scripts/build_ml_mechanics.py --stats          # verify counts")
    print("    2. python3 scripts/build_ml_mechanics.py --validate       # assert clean")
    print("    3. Implement Phase 1 mechanics (getPhase1MLMechanics())")
    print("    4. Wire always-on into EngineOrchestrator (getAlwaysOnMLMechanics())")
    print("    5. Wire real-time into tick pipeline (getRealTimeMLMechanics())")
    print("    6. Wire batch into post-run pipeline (getBatchMLMechanics())")
    print("    7. Replace IntelligenceState heuristics per mechanic's INTEGRATION NOTE")
    print()


if __name__ == "__main__":
    main()
