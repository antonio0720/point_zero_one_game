"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/core/constants.ts
// Sprint 3: Full-Scale Runtime Constants
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════
// Single source of truth for ALL game constants.
// Changes here propagate to all 7 engines automatically.
// 20M concurrent player scale: values tuned for server-authoritative runs.
// ═══════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.XP_MIN_PER_SETTLEMENT = exports.XP_PER_MONTH_CASHFLOW_UNIT = exports.SEASON_PULSE_TICKS = exports.RUN_GRADE_D_THRESHOLD = exports.RUN_GRADE_C_THRESHOLD = exports.RUN_GRADE_B_THRESHOLD = exports.RUN_GRADE_A_THRESHOLD = exports.RUN_GRADE_S_THRESHOLD = exports.PROOF_BADGE_MIN_GRADE = exports.SOVEREIGNTY_HASH_VERSION = exports.CASCADE_CATASTROPHIC_LOCKOUT = exports.CASCADE_NEMESIS_IMMUNITY = exports.CASCADE_POSITIVE_SUSTAIN_TICKS = exports.CASCADE_MAX_CONCURRENT = exports.HATER_HEAT_MAX = exports.HATER_HEAT_DECAY_PER_TICK = exports.BOT_IMMUNITY_TICKS_BASE = exports.BOT_COUNTER_INTEL_CHANCE = exports.BOT_MAX_SIMULTANEOUS = exports.TENSION_DECAY_RATE = exports.TENSION_VISIBILITY_FULL_AT = exports.TENSION_PULSE_INTERVAL = exports.TENSION_QUEUE_MAX = exports.PRESSURE_TIER_HYSTERESIS = exports.PRESSURE_CRITICAL_THRESHOLD = exports.PRESSURE_ESCALATION_RATE = exports.PRESSURE_DECAY_RATE = exports.SHIELD_REGEN_INTERVAL_TICKS = exports.SHIELD_FORTIFY_THRESHOLD = exports.SHIELD_L4_LOCKOUT_TICKS = exports.SHIELD_BANKRUPTCY_RECOVERY = exports.SABOTAGE_COUNTER_WINDOW = exports.SABOTAGE_MAX_AMMO = exports.SABOTAGE_BASE_TICKS = exports.LEGENDARY_DROP_WEIGHT = exports.FATE_SO_PCT = exports.FATE_MISSED_PCT = exports.FATE_FUBAR_PCT = exports.FATE_TICKS = exports.MAX_EQUITY_POINTS = exports.MAX_LOG = exports.MAX_HAND = exports.DRAW_TICKS = exports.FREEDOM_THRESHOLD = exports.TICK_MS = exports.MONTH_TICKS = exports.RUN_TICKS = exports.STARTING_EXPENSES = exports.STARTING_INCOME = exports.STARTING_CASH = void 0;
exports.UI_PRESSURE_PULSE_MS = exports.UI_TRANSITION_MS = exports.UI_LOG_MAX = exports.REPLAY_SNAPSHOT_INTERVAL = exports.REPLAY_MAX_EVENTS = exports.TELEMETRY_FLUSH_INTERVAL_MS = exports.TELEMETRY_BATCH_SIZE = exports.INTEGRITY_CHECK_TICKS = exports.MACRO_EVENT_TICKS = exports.ML_SIGNAL_DECAY_FACTOR = exports.ML_HEAT_DECAY_PER_TICK = exports.ML_CONFIDENCE_DECAY_PER_TICK = exports.ML_ALPHA_DRAW_REROUTE_CHANCE = exports.ML_ALPHA_DRAW_REROUTE_THRESHOLD = exports.SYNERGY_BONUS_MAX = exports.TRUST_DECAY_PER_DEFECTION = exports.RESCUE_WINDOW_CHANCE = exports.RESCUE_WINDOW_DURATION = exports.RESCUE_WINDOW_INTERVAL = exports.GHOST_TICK_INTERVAL = exports.BATTLE_ROUND_TICKS = exports.DOMINION_MAX = void 0;
// ── Run Lifecycle ──────────────────────────────────────────────────────────────
exports.STARTING_CASH = 28_000;
exports.STARTING_INCOME = 2_100;
exports.STARTING_EXPENSES = 4_800;
exports.RUN_TICKS = 720;
exports.MONTH_TICKS = 12;
exports.TICK_MS = 1000;
exports.FREEDOM_THRESHOLD = 500_000; // net worth to win FREEDOM outcome
// ── Card Mechanics ─────────────────────────────────────────────────────────────
exports.DRAW_TICKS = 24;
exports.MAX_HAND = 5;
exports.MAX_LOG = 80;
exports.MAX_EQUITY_POINTS = 120;
// ── Deck Drop Weights ──────────────────────────────────────────────────────────
// NOTE: Sprint 2+ ForcedCardQueue overrides these per-mode. Kept as fallback.
exports.FATE_TICKS = 18;
exports.FATE_FUBAR_PCT = 0.42;
exports.FATE_MISSED_PCT = 0.32;
exports.FATE_SO_PCT = 0.21;
// PRIVILEGED = 1 - (FUBAR + MISSED + SO) = 0.05
exports.LEGENDARY_DROP_WEIGHT = 1; // 1-in-100 relative weight for Legendary cards
// ── Sabotage System ────────────────────────────────────────────────────────────
exports.SABOTAGE_BASE_TICKS = 24;
exports.SABOTAGE_MAX_AMMO = 4; // Predator hater: max simultaneous sabotage slots
exports.SABOTAGE_COUNTER_WINDOW = 5; // ticks builder has to counter a filed sabotage
// ── Shield Economics ───────────────────────────────────────────────────────────
exports.SHIELD_BANKRUPTCY_RECOVERY = 5_000;
exports.SHIELD_L4_LOCKOUT_TICKS = 3; // ticks hands are locked after L4 breach
exports.SHIELD_FORTIFY_THRESHOLD = 0.95; // integrity pct to enter FORTIFIED state
exports.SHIELD_REGEN_INTERVAL_TICKS = 1; // passive regen fires every N ticks
// ── Pressure Engine ────────────────────────────────────────────────────────────
exports.PRESSURE_DECAY_RATE = 0.015; // per tick when no escalation
exports.PRESSURE_ESCALATION_RATE = 0.04; // per tick under active threat
exports.PRESSURE_CRITICAL_THRESHOLD = 0.85;
exports.PRESSURE_TIER_HYSTERESIS = 0.03; // prevents tier flapping at boundary
// ── Tension Engine ─────────────────────────────────────────────────────────────
exports.TENSION_QUEUE_MAX = 8; // max simultaneous threats in anticipation queue
exports.TENSION_PULSE_INTERVAL = 6; // anticipation pulse fires every N ticks
exports.TENSION_VISIBILITY_FULL_AT = 0.75; // score threshold for REVEALED visibility
exports.TENSION_DECAY_RATE = 0.02;
// ── Battle / Bot Engine ────────────────────────────────────────────────────────
exports.BOT_MAX_SIMULTANEOUS = 3; // max bots in ATTACKING simultaneously
exports.BOT_COUNTER_INTEL_CHANCE = 0.12; // per tick when TARGETING
exports.BOT_IMMUNITY_TICKS_BASE = 24; // after NEUTRALIZED
exports.HATER_HEAT_DECAY_PER_TICK = 0.8; // raw points shed per tick
exports.HATER_HEAT_MAX = 100;
// ── Cascade System ─────────────────────────────────────────────────────────────
exports.CASCADE_MAX_CONCURRENT = 4; // hard cap on simultaneous chains
exports.CASCADE_POSITIVE_SUSTAIN_TICKS = 12; // ticks positive cascade runs
exports.CASCADE_NEMESIS_IMMUNITY = 48; // ticks after nemesis broken
exports.CASCADE_CATASTROPHIC_LOCKOUT = 3; // card play lockout during CATASTROPHIC
// ── Sovereignty / Proof Engine ──────────────────────────────────────────────────
exports.SOVEREIGNTY_HASH_VERSION = 'PZO-v3';
exports.PROOF_BADGE_MIN_GRADE = 'B'; // minimum grade for proof badge issuance
exports.RUN_GRADE_S_THRESHOLD = 900;
exports.RUN_GRADE_A_THRESHOLD = 750;
exports.RUN_GRADE_B_THRESHOLD = 600;
exports.RUN_GRADE_C_THRESHOLD = 450;
exports.RUN_GRADE_D_THRESHOLD = 300;
// ── Season / XP ───────────────────────────────────────────────────────────────
exports.SEASON_PULSE_TICKS = 60;
exports.XP_PER_MONTH_CASHFLOW_UNIT = 500; // $500 monthly cashflow = 1 XP
exports.XP_MIN_PER_SETTLEMENT = 5;
exports.DOMINION_MAX = 1000;
// ── Mode-Specific ─────────────────────────────────────────────────────────────
exports.BATTLE_ROUND_TICKS = 60; // Predator: PvP round length
exports.GHOST_TICK_INTERVAL = 75; // Phantom: ghost replay step interval
exports.RESCUE_WINDOW_INTERVAL = 120; // Syndicate: ticks between rescue windows
exports.RESCUE_WINDOW_DURATION = 30; // Syndicate: rescue window length in ticks
exports.RESCUE_WINDOW_CHANCE = 0.25; // Syndicate: probability of window opening
exports.TRUST_DECAY_PER_DEFECTION = 0.15; // Syndicate: trust score hit per defection step
exports.SYNERGY_BONUS_MAX = 2.0; // Syndicate: max co-op multiplier
// ── ML / Alpha Engine ──────────────────────────────────────────────────────────
exports.ML_ALPHA_DRAW_REROUTE_THRESHOLD = 0.20;
exports.ML_ALPHA_DRAW_REROUTE_CHANCE = 0.55;
exports.ML_CONFIDENCE_DECAY_PER_TICK = 0.001;
exports.ML_HEAT_DECAY_PER_TICK = 0.012;
exports.ML_SIGNAL_DECAY_FACTOR = 0.93;
// ── PvP / Integrity ────────────────────────────────────────────────────────────
exports.MACRO_EVENT_TICKS = 55;
exports.INTEGRITY_CHECK_TICKS = 45;
// ── Telemetry Flush (20M scale — batched, not per-event) ─────────────────────
exports.TELEMETRY_BATCH_SIZE = 50; // events per batch flush
exports.TELEMETRY_FLUSH_INTERVAL_MS = 2000; // max wait before flush
// ── Replay ────────────────────────────────────────────────────────────────────
exports.REPLAY_MAX_EVENTS = 2000; // truncated if run produces more
exports.REPLAY_SNAPSHOT_INTERVAL = 60; // full state snapshot every N ticks
// ── UI / Display ──────────────────────────────────────────────────────────────
exports.UI_LOG_MAX = 80;
exports.UI_TRANSITION_MS = 180; // standard component transition
exports.UI_PRESSURE_PULSE_MS = 900; // CRITICAL pressure pulse animation
//# sourceMappingURL=constants.js.map